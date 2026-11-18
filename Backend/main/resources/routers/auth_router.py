import hashlib
import hmac
import logging
import secrets
from html import escape

import psycopg2.extras
from fastapi import APIRouter, BackgroundTasks, HTTPException, Depends, Request, Response, status

from ..bd.db import get_connection
from ..schemas.servo_schema import MeuResumo, MinhaFrequencia, MeuFoguinho
from ..schemas.auth_schema import (
    LoginRequest,
    RegisterRequest,
    TrocarSenhaRequest,
    RecuperarSenhaRequest,
    RedefinirSenhaRequest,
    TokenResponse,
    UsuarioLogado,
)
from ..config.security import (
    HASH_FALSO,
    JWT_EXPIRES_DAYS,
    hash_senha,
    verificar_senha,
    gerar_token,
    get_current_user,
    require_admin,
    buscar_usuario_ativo,
)
from ..config import security
from ..config.email import enviar_email
from ..config.rate_limit import (
    ip_do_cliente,
    limitador_login,
    limitador_pedido_email,
    limitador_recuperacao_ip,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["Auth"])

_limitador_login = limitador_login

# ── POST /auth/login ──────────────────────────────────────────────────────────
#
# Fluxo:
# 1. Busca o usuário pelo email
# 2. Verifica a senha com bcrypt
# 3. Confere se o acesso está liberado (login ativo e servo Ativo)
# 4. Gera e retorna o token JWT (30 dias)
#
# IMPORTANTE: nunca diga se foi o email ou a senha que errou —
# "Credenciais inválidas" para ambos os casos evita que alguém
# descubra quais emails estão cadastrados.

@router.post("/login", response_model=TokenResponse)
def login(body: LoginRequest, request: Request):

    email = body.email.lower()
    chave = f"{ip_do_cliente(request)}|{email}"
    _limitador_login.verificar(chave)

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT u.id_usuario, u.senha_hash,
                           u.ativo AND (u.id_servo IS NULL OR s.status = 'Ativo') AS liberado,
                           u.versao_sessao
                    FROM usuario u
                    LEFT JOIN servo s ON s.id_servo = u.id_servo
                    WHERE lower(u.email) = %s
                """, (email,))
                usuario = cursor.fetchone()

    except Exception as e:
        logger.error(f"Erro ao buscar usuário no login: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    # Valida email e senha — mesma mensagem para os dois casos (segurança)
    senha_ok = verificar_senha(body.senha, usuario[1] if usuario else HASH_FALSO)
    if not usuario or not senha_ok:
        _limitador_login.registrar_falha(chave)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Credenciais inválidas."
        )

    # Senha certa, mas acesso bloqueado (login desativado ou servo afastado)
    if not usuario[2]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Seu acesso está inativo. Fale com a coordenação."
        )

    _limitador_login.limpar(chave)
    return _resposta_login(usuario[0], usuario[3])


def _resposta_login(id_usuario: int, versao_sessao: int) -> TokenResponse:
    """Token + usuário logado; usado pelo login e pela redefinição de senha."""
    token = gerar_token(id_usuario, versao_sessao)

    # Mesmo cálculo de perfis do /auth/me (perfil manual + pastas do ano)
    logado = buscar_usuario_ativo(id_usuario)
    if not logado:
        raise HTTPException(status_code=500, detail="Erro interno.")

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "UPDATE usuario SET ultimo_login = now() WHERE id_usuario = %s",
                    (id_usuario,)
                )
    except Exception as e:
        # Não impede o login
        logger.warning(f"Não foi possível registrar o último login: {e}")

    return TokenResponse(
        access_token=token,
        expira_em_dias=JWT_EXPIRES_DAYS,
        usuario=logado,
    )


# ── Recuperação de senha pelo email ───────────────────────────────────────────
#
# 1. POST /auth/recuperar-senha {email}: se o email for de uma conta com acesso
#    liberado, manda um código de 6 números que vale CODIGO_MINUTOS. A resposta
#    é sempre a mesma (não revela quais emails têm conta) e o envio roda em
#    segundo plano (o tempo de resposta também não revela).
# 2. POST /auth/redefinir-senha {email, codigo, senha_nova}: confere o código,
#    troca a senha, desconecta os outros aparelhos e já devolve o login.
#
# O banco guarda só o HMAC do código. Cada código aceita CODIGO_TENTATIVAS erros;
# pedir um novo apaga os anteriores.

CODIGO_MINUTOS = 15
CODIGO_TENTATIVAS = 5

_MENSAGEM_ENVIADO = (
    "Se este email tiver conta no Agapello, enviamos um código para ele. "
    "Confira a caixa de entrada e o spam."
)
_CODIGO_INVALIDO = "Código incorreto ou vencido. Confira o último email recebido ou peça um novo código."


def _hash_codigo(id_usuario: int, codigo: str) -> str:
    chave = (security.JWT_SECRET or "").encode("utf-8")
    return hmac.new(chave, f"{id_usuario}:{codigo}".encode("utf-8"), hashlib.sha256).hexdigest()


def _enviar_codigo(email: str) -> None:
    """Roda depois da resposta. Falhas ficam só no log."""
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT u.id_usuario, u.nome, s.apelido
                    FROM usuario u
                    LEFT JOIN servo s ON s.id_servo = u.id_servo
                    WHERE lower(u.email) = %s
                      AND u.ativo AND (u.id_servo IS NULL OR s.status = 'Ativo')
                """, (email,))
                usuario = cursor.fetchone()
                if not usuario:
                    return

                codigo = f"{secrets.randbelow(10**6):06d}"
                cursor.execute("DELETE FROM recuperacao_senha WHERE id_usuario = %s", (usuario[0],))
                cursor.execute("""
                    INSERT INTO recuperacao_senha (id_usuario, codigo_hash, expira_em)
                    VALUES (%s, %s, now() + make_interval(mins => %s))
                """, (usuario[0], _hash_codigo(usuario[0], codigo), CODIGO_MINUTOS))
    except Exception as e:
        logger.error(f"Erro ao gerar código de recuperação: {e}")
        return

    nome = usuario[2] or usuario[1].split()[0]
    texto = (
        f"Olá, {nome}!\n\n"
        f"Seu código para criar uma nova senha no Agapello é: {codigo}\n\n"
        f"Ele vale por {CODIGO_MINUTOS} minutos. Se não foi você que pediu, ignore este "
        f"email: sua senha continua a mesma."
    )
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;color:#222">
      <p>Olá, {escape(nome)}!</p>
      <p>Seu código para criar uma nova senha no <b>Agapello</b> é:</p>
      <p style="font-size:32px;font-weight:bold;letter-spacing:8px;text-align:center;margin:24px 0">{codigo}</p>
      <p>Ele vale por {CODIGO_MINUTOS} minutos.</p>
      <p style="color:#666;font-size:13px">Se não foi você que pediu, ignore este email: sua senha continua a mesma.</p>
    </div>"""
    if not enviar_email(email, usuario[1], f"Agapello: seu código é {codigo}", texto, html):
        logger.error(f"Código de recuperação do usuário #{usuario[0]} não foi enviado.")


@router.post("/recuperar-senha")
def recuperar_senha(body: RecuperarSenhaRequest, request: Request, tarefas: BackgroundTasks):
    email = body.email.lower()
    ip = ip_do_cliente(request)
    limitador_recuperacao_ip.verificar(ip)
    limitador_pedido_email.verificar(email)
    # Conta todo pedido, exista o email ou não (para não revelar nada)
    limitador_recuperacao_ip.registrar_falha(ip)
    limitador_pedido_email.registrar_falha(email)

    tarefas.add_task(_enviar_codigo, email)
    return {"mensagem": _MENSAGEM_ENVIADO, "validade_minutos": CODIGO_MINUTOS}


@router.post("/redefinir-senha", response_model=TokenResponse)
def redefinir_senha(body: RedefinirSenhaRequest, request: Request):
    email = body.email.lower()
    ip = ip_do_cliente(request)
    limitador_recuperacao_ip.verificar(ip)

    valido = False
    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    SELECT r.id_recuperacao, r.codigo_hash, r.tentativas, u.id_usuario
                    FROM recuperacao_senha r
                    JOIN usuario u ON u.id_usuario = r.id_usuario
                    LEFT JOIN servo s ON s.id_servo = u.id_servo
                    WHERE lower(u.email) = %s AND r.expira_em > now()
                      AND u.ativo AND (u.id_servo IS NULL OR s.status = 'Ativo')
                    ORDER BY r.criado_em DESC
                    LIMIT 1
                    FOR UPDATE OF r
                """, (email,))
                pedido = cursor.fetchone()

                if pedido and pedido[2] < CODIGO_TENTATIVAS:
                    if hmac.compare_digest(pedido[1], _hash_codigo(pedido[3], body.codigo)):
                        valido = True
                        cursor.execute("""
                            UPDATE usuario
                            SET senha_hash = %s, trocar_senha = false,
                                versao_sessao = versao_sessao + 1
                            WHERE id_usuario = %s
                            RETURNING versao_sessao
                        """, (hash_senha(body.senha_nova), pedido[3]))
                        versao = cursor.fetchone()[0]
                        cursor.execute("DELETE FROM recuperacao_senha WHERE id_usuario = %s", (pedido[3],))
                    else:
                        # Gravada de verdade: o erro só sobe depois do commit
                        cursor.execute(
                            "UPDATE recuperacao_senha SET tentativas = tentativas + 1 WHERE id_recuperacao = %s",
                            (pedido[0],)
                        )

    except Exception as e:
        logger.error(f"Erro ao redefinir senha: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    if not valido:
        limitador_recuperacao_ip.registrar_falha(ip)
        raise HTTPException(status_code=400, detail=_CODIGO_INVALIDO)

    # Senha nova: some o bloqueio de senha errada em qualquer aparelho
    limitador_login.limpar_email(email)
    return _resposta_login(pedido[3], versao)


# ── GET /auth/config ──────────────────────────────────────────────────────────

@router.get("/config")
def config():
    """O app consulta ao abrir para saber se já precisa exigir login."""
    return {"login_obrigatorio": security.LOGIN_OBRIGATORIO}


# ── GET /auth/me ──────────────────────────────────────────────────────────────
#
# Retorna o usuário logado (lido do banco). O app usa ao abrir para saber se a
# sessão salva continua válida.

@router.get("/me", response_model=UsuarioLogado)
def me(usuario: UsuarioLogado = Depends(get_current_user)):
    return usuario


# ── GET /auth/me/resumo ───────────────────────────────────────────────────────
#
# Tela Minha conta: frequência do ano (reinicia em 1º de janeiro), foguinho
# (não zera na virada do ano) e pastas do ano de quem está logado.
# Só missões que já aconteceram e que contam frequência, como no foguinho.

@router.get("/me/resumo", response_model=MeuResumo)
def meu_resumo(usuario: UsuarioLogado = Depends(get_current_user)):

    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute("SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS ano")
                ano = cursor.fetchone()["ano"]

                if usuario.id_servo is None:
                    return MeuResumo(ano=ano)

                cursor.execute("""
                    SELECT m.data::text AS data, m.descricao, f.status
                    FROM frequencia f
                    JOIN missao m ON m.id_missao = f.id_missao
                    WHERE f.id_servo = %s
                      AND m.conta_frequencia
                      AND m.data <= CURRENT_DATE
                      AND EXTRACT(YEAR FROM m.data) = %s
                    ORDER BY m.data DESC, m.id_missao DESC
                """, (usuario.id_servo, ano))
                missoes = cursor.fetchall()

                cursor.execute("""
                    SELECT sequencia_atual, recorde, chama_acesa
                    FROM vw_sequencia_servo
                    WHERE id_servo = %s
                """, (usuario.id_servo,))
                foguinho = cursor.fetchone()

                cursor.execute("""
                    SELECT p.nome, sp.momento, sp.coordenador
                    FROM servo_pasta sp
                    JOIN pasta p ON p.id_pasta = sp.id_pasta
                    WHERE sp.id_servo = %s AND sp.ano = %s
                    ORDER BY sp.momento, p.nome
                """, (usuario.id_servo, ano))
                pastas = cursor.fetchall()

    except Exception as e:
        logger.error(f"Erro ao buscar o resumo do usuário {usuario.id}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    contagem = {s: sum(1 for m in missoes if m["status"] == s) for s in ("Presente", "Justificada", "Falta")}
    total = len(missoes)

    return MeuResumo(
        ano=ano,
        id_servo=usuario.id_servo,
        frequencia=MinhaFrequencia(
            presente=contagem["Presente"],
            justificada=contagem["Justificada"],
            falta=contagem["Falta"],
            # Mesma conta da tela de frequência: justificada conta como presença
            percentual_presenca=(
                round((contagem["Presente"] + contagem["Justificada"]) * 100 / total, 2) if total else None
            ),
        ),
        missoes=missoes,
        foguinho=MeuFoguinho(**foguinho) if foguinho else MeuFoguinho(),
        pastas=pastas,
    )


# ── PUT /auth/senha ───────────────────────────────────────────────────────────

@router.put("/senha", status_code=204)
def trocar_senha(body: TrocarSenhaRequest, usuario: UsuarioLogado = Depends(get_current_user)):

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute(
                    "SELECT senha_hash FROM usuario WHERE id_usuario = %s",
                    (usuario.id,)
                )
                atual = cursor.fetchone()

                if not atual or not verificar_senha(body.senha_atual, atual[0]):
                    raise HTTPException(status_code=400, detail="Senha atual incorreta.")
                if body.senha_nova == body.senha_atual:
                    raise HTTPException(status_code=400, detail="A nova senha precisa ser diferente da atual.")

                # Trocou a senha → deixa de ser temporária
                cursor.execute(
                    "UPDATE usuario SET senha_hash = %s, trocar_senha = false WHERE id_usuario = %s",
                    (hash_senha(body.senha_nova), usuario.id)
                )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao trocar senha do usuário {usuario.id}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return Response(status_code=204)


# ── POST /auth/register ───────────────────────────────────────────────────────
#
# Cria um novo usuário — restrito a administradores.
# A senha é transformada em hash ANTES de salvar no banco.

@router.post("/register", response_model=UsuarioLogado, status_code=201)
def register(
    body: RegisterRequest,
    _: UsuarioLogado = Depends(require_admin),  # só administrador pode criar usuários
):

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:

                # Verifica se email já existe
                cursor.execute(
                    "SELECT id_usuario FROM usuario WHERE lower(email) = %s",
                    (body.email.lower(),)
                )
                if cursor.fetchone():
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Email já cadastrado."
                    )

                # Salva com senha em hash — nunca em texto puro
                cursor.execute(
                    """
                    INSERT INTO usuario (nome, email, senha_hash, perfil, id_servo)
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id_usuario, nome, email, perfil, id_servo
                    """,
                    (body.nome, body.email.lower(), hash_senha(body.senha), body.perfil, body.id_servo)
                )

                novo = cursor.fetchone()

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao registrar usuário: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return UsuarioLogado(
        id=novo[0],
        nome=novo[1],
        email=novo[2],
        perfil=novo[3],
        id_servo=novo[4],
    )
