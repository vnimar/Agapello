import json
import logging
import sys
from typing import Any

# ── Auditoria ─────────────────────────────────────────────────────────────────
#
# Toda chamada que altera dados (POST/PUT/PATCH/DELETE) vira uma linha no log,
# com quem fez, o que mandou e a resposta. Fica pesquisável nos logs do Render
# (procure por "[auditoria]"); o Render guarda poucos dias, não é histórico.
#
# O usuário vem de get_optional_user, que o guarda em request.state.usuario.

METODOS_AUDITADOS = {"POST", "PUT", "PATCH", "DELETE"}

# Campos que nunca vão para o log (comparação sem maiúsculas, por trecho do nome)
CAMPOS_SENSIVEIS = ("senha", "password", "token", "pin", "secret")

LIMITE_CORPO = 500  # caracteres do corpo no log; importações grandes são cortadas

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
                logger.info(
                    "%s %s %s | %s | %s",
                    scope["method"], rota, status["codigo"],
                    _quem(scope["state"].get("usuario")),
                    _resumo_corpo(b"".join(partes), content_type),
                )
            except Exception:  # log nunca derruba a requisição
                logger.exception("Falha ao registrar auditoria")
