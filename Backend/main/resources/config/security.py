import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
from jose import JWTError, jwt
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from dotenv import load_dotenv

from ..bd.db import get_connection
from ..schemas.auth_schema import UsuarioLogado, PerfilType, ordenar_perfis

load_dotenv()

logger = logging.getLogger(__name__)

# ── Configuração ──────────────────────────────────────────────────────────────
#
# JWT_SECRET: chave usada para assinar o token
# JWT_EXPIRES_DAYS: por quantos dias o usuário continua logado (padrão 30)

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRES_DAYS = int(os.getenv("JWT_EXPIRES_DAYS", 30))

# Sem JWT_SECRET o login fica indisponível, mas o resto da API continua no ar
# (o login ainda é opcional).
if not JWT_SECRET:
    logger.error("JWT_SECRET não configurada: login desativado.")

# Enquanto nem todos têm conta, chamadas sem login continuam liberadas e só ficam
# registradas no log. Quando todos tiverem conta, ligue LOGIN_OBRIGATORIO=true no Render.
# Quem está logado já é limitado pelo perfil nos dois modos.
LOGIN_OBRIGATORIO = os.getenv("LOGIN_OBRIGATORIO", "false").lower() == "true"

# Perfis que podem administrar o calendário (e futuramente outros cadastros)
PERFIS_ADMIN: tuple[PerfilType, ...] = ("administrador", "coordenador_geral")

# Perfis que cuidam dos servos: lista de servos e chamada de servos
PERFIS_COORD_SERVOS: tuple[PerfilType, ...] = (
    "coordenador_formacao_vivencia",
    "coordenador_geral",
    "administrador",
)

# Perfis da chamada de cursistas. Coordenador e tutor veem só a própria
# comunidade (vw_responsaveis_comunidade); coord. geral e administrador, todas.
PERFIS_CURSISTAS: tuple[PerfilType, ...] = (
    "coordenador_comunidade_cursista",
    "tutor_comunidade_cursista",
    "coordenador_geral",
    "administrador",
)

# ── Hash de senha ─────────────────────────────────────────────────────────────
#
# bcrypt é o padrão para hash de senha; nunca salve senha em texto puro.
# Usamos a biblioteca bcrypt direto: o passlib 1.7.4 é incompatível com bcrypt 5.
# O bcrypt só considera os primeiros 72 bytes — o schema limita o tamanho.

def hash_senha(senha: str) -> str:
    """Gera o hash bcrypt da senha. Use antes de salvar no banco."""
    return bcrypt.hashpw(senha.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar_senha(senha_pura: str, senha_hash: Optional[str]) -> bool:
    """Compara a senha digitada com o hash do banco."""
    if not senha_hash:
        return False
    try:
        return bcrypt.checkpw(senha_pura.encode("utf-8"), senha_hash.encode("utf-8"))
    except ValueError:
        return False


# Hash fixo usado quando o email não existe: o login demora o mesmo tempo nos
# dois casos, para não revelar quais emails estão cadastrados.
HASH_FALSO = hash_senha("usuario-inexistente")

# ── Token JWT ─────────────────────────────────────────────────────────────────
#
# O token guarda só o id do usuário e a expiração. Perfil, nome e status são
# lidos do banco a cada requisição: se alguém for inativado ou mudar de perfil,
# vale na hora, sem esperar o token vencer.

def _exigir_secret() -> str:
    if not JWT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Login indisponível: JWT_SECRET não configurada no servidor."
        )
    return JWT_SECRET


def gerar_token(id_usuario: int) -> str:
    """Gera um JWT para o usuário, válido por JWT_EXPIRES_DAYS dias."""
    expiracao = datetime.now(timezone.utc) + timedelta(days=JWT_EXPIRES_DAYS)
    payload = {"sub": str(id_usuario), "exp": expiracao}
    return jwt.encode(payload, _exigir_secret(), algorithm=JWT_ALGORITHM)


def buscar_usuario_ativo(id_usuario: int) -> Optional[UsuarioLogado]:
    """
    Usuário com acesso liberado: login ativo e, se ligado a um servo, servo Ativo.
    Os perfis somam o perfil manual (usuario.perfil) com os das pastas do ano
    vigente (vw_perfis_pasta) — trocou de pasta, o acesso muda na hora.
    """
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute("""
                SELECT u.id_usuario, u.nome, u.email, u.perfil, u.id_servo, u.trocar_senha,
                       COALESCE(pp.perfis, '{}') AS perfis_pasta
                FROM usuario u
                LEFT JOIN servo s ON s.id_servo = u.id_servo
                LEFT JOIN vw_perfis_pasta pp ON pp.id_servo = u.id_servo
                WHERE u.id_usuario = %s
                  AND u.ativo
                  AND (u.id_servo IS NULL OR s.status = 'Ativo')
            """, (id_usuario,))
            row = cursor.fetchone()

    if not row:
        return None
    perfis = ordenar_perfis([row[3], *row[6]])
    return UsuarioLogado(
        id=row[0], nome=row[1], email=row[2], perfil=perfis[0], perfis=perfis,
        id_servo=row[4], trocar_senha=row[5],
    )


# ── Dependências do FastAPI ───────────────────────────────────────────────────
#
# Lê o token do header "Authorization: Bearer <token>".

_bearer = HTTPBearer(auto_error=False)

_credenciais_invalidas = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Sessão expirada ou inválida. Faça login novamente.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_optional_user(
    request: Request,
    credenciais: Optional[HTTPAuthorizationCredentials] = Depends(_bearer),
) -> Optional[UsuarioLogado]:
    """
    Usuário logado, ou None se a requisição veio sem token.
    Token presente mas inválido/expirado → 401 (o app então faz logout).
    Fica também em request.state.usuario para o log de auditoria.
    """
    if credenciais is None:
        return None

    try:
        payload = jwt.decode(credenciais.credentials, _exigir_secret(), algorithms=[JWT_ALGORITHM])
        id_usuario = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        raise _credenciais_invalidas

    usuario = buscar_usuario_ativo(id_usuario)
    if not usuario:
        raise _credenciais_invalidas
    request.state.usuario = usuario
    return usuario


def get_current_user(usuario: Optional[UsuarioLogado] = Depends(get_optional_user)) -> UsuarioLogado:
    """Exige login."""
    if usuario is None:
        raise _credenciais_invalidas
    return usuario


def require_perfil(*perfis: PerfilType):
    """
    Exige um dos perfis. Uso:
        @router.post("/rota", dependencies=[Depends(require_perfil("administrador"))])
    """
    def dependencia(usuario: UsuarioLogado = Depends(get_current_user)) -> UsuarioLogado:
        if not usuario.tem(*perfis):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seu perfil não tem acesso a esta função."
            )
        return usuario
    return dependencia


require_admin = require_perfil("administrador")


def exigir_perfil(*perfis: PerfilType):
    """
    Como require_perfil, mas respeitando a transição do LOGIN_OBRIGATORIO:
    sem login, libera (e registra no log) enquanto o login não for obrigatório.
    Sem perfis informados, basta estar logado. Devolve o usuário, ou None sem login.
    """
    def dependencia(
        request: Request,
        usuario: Optional[UsuarioLogado] = Depends(get_optional_user),
    ) -> Optional[UsuarioLogado]:
        if usuario is None:
            if LOGIN_OBRIGATORIO:
                raise _credenciais_invalidas
            logger.warning("Chamada sem login: %s %s", request.method, request.url.path)
            return None
        if perfis and not usuario.tem(*perfis):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Seu perfil não tem acesso a esta função."
            )
        return usuario
    return dependencia


# Dependências prontas, usadas nos routers
exigir_login = exigir_perfil()
exigir_coord_servos = exigir_perfil(*PERFIS_COORD_SERVOS)
