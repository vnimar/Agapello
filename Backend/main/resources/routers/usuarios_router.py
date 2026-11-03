import logging
import secrets

import psycopg2
import psycopg2.extras
from fastapi import APIRouter, Depends, HTTPException, status

from ..bd.db import get_connection
from ..config.security import hash_senha, require_admin
from ..schemas.auth_schema import UsuarioLogado
from ..schemas.usuario_schema import (
    SenhaTemporariaResponse,
    UsuarioCriar,
    UsuarioEditar,
    UsuarioItem,
)

logger = logging.getLogger(__name__)

# Contas de acesso: só o administrador
router = APIRouter(prefix="/usuarios", tags=["Usuários"], dependencies=[Depends(require_admin)])

SELECT_USUARIO = """
    SELECT u.id_usuario AS id, u.nome, u.email, u.perfil, u.ativo, u.id_servo,
           s.nome AS servo_nome, (s.status = 'Ativo') AS servo_ativo,
           u.trocar_senha, u.ultimo_login,
           COALESCE(pp.perfis, '{}') AS perfis_pasta
    FROM usuario u
    LEFT JOIN servo s ON s.id_servo = u.id_servo
    LEFT JOIN vw_perfis_pasta pp ON pp.id_servo = u.id_servo
"""

# Sem letras/números parecidos (0/O, 1/l/I) para ditar ou digitar sem erro
_ALFABETO = "abcdefghjkmnpqrstuvwxyz23456789"


def gerar_senha_temporaria() -> str:
    """Ex.: k7mp-x3qa-9vtw"""
    return "-".join("".join(secrets.choice(_ALFABETO) for _ in range(4)) for _ in range(3))


def _buscar(cursor, id_usuario: int) -> UsuarioItem:
    cursor.execute(SELECT_USUARIO + " WHERE u.id_usuario = %s", (id_usuario,))
    linha = cursor.fetchone()
    if not linha:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    return UsuarioItem(**linha)


def _conflito(e: psycopg2.errors.UniqueViolation) -> HTTPException:
    if "servo" in (e.diag.constraint_name or ""):
        return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Este servo já tem um login.")
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado.")


def _conferir_servo(cursor, id_servo):
    if id_servo is None:
        return
    cursor.execute("SELECT 1 FROM servo WHERE id_servo = %s", (id_servo,))
    if not cursor.fetchone():
        raise HTTPException(status_code=400, detail="Servo não encontrado.")


def _email_em_uso(cursor, email: str, id_usuario: int = 0) -> None:
    cursor.execute(
        "SELECT 1 FROM usuario WHERE lower(email) = %s AND id_usuario <> %s",
        (email.lower(), id_usuario)
    )
    if cursor.fetchone():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email já cadastrado.")


# ── GET /usuarios ─────────────────────────────────────────────────────────────

@router.get("/", response_model=list[UsuarioItem])
def listar_usuarios():
    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            # Contas de servos excluídos ficam só como registro (sem email nem acesso)
            cursor.execute(SELECT_USUARIO + " WHERE s.status IS DISTINCT FROM 'Excluido'"
                                            " ORDER BY u.ativo DESC, lower(u.nome)")
            return [UsuarioItem(**linha) for linha in cursor.fetchall()]

    except Exception as e:
        logger.error(f"Erro ao listar usuários: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")


# ── POST /usuarios ────────────────────────────────────────────────────────────
#
# Cria a conta com uma senha temporária, que a pessoa troca no primeiro acesso.

@router.post("/", response_model=SenhaTemporariaResponse, status_code=201)
def criar_usuario(body: UsuarioCriar):
    senha = gerar_senha_temporaria()

    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            _email_em_uso(cursor, body.email)
            _conferir_servo(cursor, body.id_servo)
            cursor.execute(
                """
                INSERT INTO usuario (nome, email, senha_hash, perfil, id_servo, trocar_senha)
                VALUES (%s, %s, %s, %s, %s, true)
                RETURNING id_usuario
                """,
                (body.nome, body.email.lower(), hash_senha(senha), body.perfil, body.id_servo)
            )
            usuario = _buscar(cursor, cursor.fetchone()["id_usuario"])

    except HTTPException:
        raise

    except psycopg2.errors.UniqueViolation as e:
        raise _conflito(e)

    except Exception as e:
        logger.error(f"Erro ao criar usuário: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return SenhaTemporariaResponse(usuario=usuario, senha_temporaria=senha)


# ── PUT /usuarios/{id} ────────────────────────────────────────────────────────

@router.put("/{id_usuario}", response_model=UsuarioItem)
def editar_usuario(
    id_usuario: int,
    body: UsuarioEditar,
    admin: UsuarioLogado = Depends(require_admin),
):
    # Evita o administrador se trancar para fora do sistema
    if id_usuario == admin.id and (not body.ativo or body.perfil != "administrador"):
        raise HTTPException(
            status_code=400,
            detail="Você não pode desativar a própria conta nem tirar o próprio perfil de administrador."
        )

    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            _email_em_uso(cursor, body.email, id_usuario)
            _conferir_servo(cursor, body.id_servo)
            cursor.execute(
                """
                UPDATE usuario
                SET nome = %s, email = %s, perfil = %s, id_servo = %s, ativo = %s
                WHERE id_usuario = %s
                """,
                (body.nome, body.email.lower(), body.perfil, body.id_servo, body.ativo, id_usuario)
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Usuário não encontrado.")
            return _buscar(cursor, id_usuario)

    except HTTPException:
        raise

    except psycopg2.errors.UniqueViolation as e:
        raise _conflito(e)

    except Exception as e:
        logger.error(f"Erro ao editar usuário {id_usuario}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")


# ── POST /usuarios/{id}/resetar-senha ─────────────────────────────────────────
#
# Para quem esqueceu a senha: gera uma temporária, que a pessoa troca ao entrar.

@router.post("/{id_usuario}/resetar-senha", response_model=SenhaTemporariaResponse)
def resetar_senha(id_usuario: int):
    senha = gerar_senha_temporaria()

    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(
                "UPDATE usuario SET senha_hash = %s, trocar_senha = true WHERE id_usuario = %s",
                (hash_senha(senha), id_usuario)
            )
            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="Usuário não encontrado.")
            usuario = _buscar(cursor, id_usuario)

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao resetar senha do usuário {id_usuario}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return SenhaTemporariaResponse(usuario=usuario, senha_temporaria=senha)
