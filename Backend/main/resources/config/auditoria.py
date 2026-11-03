import json
import logging
import sys
from datetime import date
from typing import Any

import anyio

# ── Auditoria ─────────────────────────────────────────────────────────────────
#
# Toda chamada que altera dados (POST/PUT/PATCH/DELETE) vira uma linha no log,
# com quem fez, o que mandou e a resposta. Fica pesquisável nos logs do Render
# (procure por "[auditoria]"); o Render guarda poucos dias.
#
# As que deram certo também vão para a tabela auditoria (migration 017), que é o
# histórico: guarda 1 ano e o mais antigo é apagado uma vez por dia.
#
# O usuário vem de get_optional_user, que o guarda em request.state.usuario.

METODOS_AUDITADOS = {"POST", "PUT", "PATCH", "DELETE"}

# Campos que nunca vão para o log (comparação sem maiúsculas, por trecho do nome)
# Dados pessoais também: o log mostra quem alterou, não o conteúdo
CAMPOS_SENSIVEIS = ("senha", "password", "token", "pin", "secret", "telefone", "endereco", "nascimento")

LIMITE_CORPO = 500  # caracteres do corpo no log; importações grandes são cortadas

# Não é alteração de dados: fica só no log do Render
ROTAS_FORA_DO_HISTORICO = ("/auth/login",)
DIAS_GUARDADOS = 365
_ultima_limpeza: dict[str, date] = {}

logger = logging.getLogger("auditoria")
logger.setLevel(logging.INFO)
logger.propagate = False
if not logger.handlers:
    _handler = logging.StreamHandler(sys.stdout)
    _handler.setFormatter(logging.Formatter("%(asctime)s [auditoria] %(message)s"))
    logger.addHandler(_handler)


def _mascarar(valor: Any) -> Any:
    if isinstance(valor, dict):
        return {
            k: "***" if any(s in str(k).lower() for s in CAMPOS_SENSIVEIS) else _mascarar(v)
            for k, v in valor.items()
        }
    if isinstance(valor, list):
        return [_mascarar(v) for v in valor]
    return valor


def _resumo_corpo(corpo: bytes, content_type: str) -> str:
    if not corpo:
        return "-"
    if "multipart/form-data" in content_type:
        return f"[arquivo, {len(corpo)} bytes]"
    try:
        texto = json.dumps(_mascarar(json.loads(corpo)), ensure_ascii=False, separators=(",", ":"))
    except ValueError:
        return f"[{len(corpo)} bytes]"
    if len(texto) > LIMITE_CORPO:
        texto = texto[:LIMITE_CORPO] + f"… (+{len(texto) - LIMITE_CORPO})"
    return texto


def _quem(usuario: Any) -> str:
    if usuario is None:
        return "sem login"
    return f"{usuario.nome} (#{usuario.id}, {usuario.perfil})"


def fora_do_historico(request) -> None:
    """A rota não alterou nada (ex.: prévia de importação): fica só no log do Render."""
    request.state.auditoria_ignorar = True


def _gravar_no_banco(usuario: Any, metodo: str, rota: str, status: int, corpo: str) -> None:
    """Roda numa thread (psycopg2 é síncrono). Falha aqui nunca derruba a requisição."""
    from ..bd.db import get_connection  # aqui dentro: o middleware é montado antes do banco

    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute("""
                INSERT INTO auditoria (id_usuario, usuario, metodo, rota, status, corpo)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, (getattr(usuario, "id", None), _quem(usuario) if usuario else None, metodo, rota, status, corpo))
            if _ultima_limpeza.get("dia") != date.today():
                cursor.execute("DELETE FROM auditoria WHERE criado_em < now() - make_interval(days => %s)",
                               (DIAS_GUARDADOS,))
                _ultima_limpeza["dia"] = date.today()
    except Exception:
        logger.exception("Falha ao gravar auditoria no banco")


class AuditoriaMiddleware:
    """Middleware ASGI puro: lê o corpo sem consumir o que a rota vai receber."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http" or scope["method"] not in METODOS_AUDITADOS:
            await self.app(scope, receive, send)
            return

        partes: list[bytes] = []
        status = {"codigo": 500}  # se a rota estourar sem responder

        async def receive_gravando():
            mensagem = await receive()
            if mensagem["type"] == "http.request":
                partes.append(mensagem.get("body", b""))
            return mensagem

        async def send_gravando(mensagem):
            if mensagem["type"] == "http.response.start":
                status["codigo"] = mensagem["status"]
            await send(mensagem)

        # request.state escreve em scope["state"]; garante o mesmo dict até a rota
        scope.setdefault("state", {})
        try:
            await self.app(scope, receive_gravando, send_gravando)
        finally:
            try:
                headers = dict(scope.get("headers") or [])
                content_type = headers.get(b"content-type", b"").decode("latin-1")
                rota = scope["path"]
                if scope.get("query_string"):
                    rota += "?" + scope["query_string"].decode("latin-1")
                usuario = scope["state"].get("usuario")
                corpo = _resumo_corpo(b"".join(partes), content_type)
                logger.info(
                    "%s %s %s | %s | %s",
                    scope["method"], rota, status["codigo"], _quem(usuario), corpo,
                )
            except Exception:  # log nunca derruba a requisição
                logger.exception("Falha ao registrar auditoria")
            else:
                if (status["codigo"] < 400 and not scope["path"].startswith(ROTAS_FORA_DO_HISTORICO)
                        and not scope["state"].get("auditoria_ignorar")):
                    await anyio.to_thread.run_sync(
                        _gravar_no_banco, usuario, scope["method"], rota, status["codigo"], corpo)
