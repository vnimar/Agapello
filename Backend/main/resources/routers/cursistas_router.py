import logging
from fastapi import APIRouter, HTTPException, Depends
from ..bd.db import get_connection
import psycopg2.extras
from ..config.security import PERFIS_ADMIN, PERFIS_CURSISTAS, require_perfil
from ..schemas.auth_schema import UsuarioLogado
from ..schemas.frequencia_schema import MessageResponse
from ..schemas.cursista_schema import (
    ChamadaCursistaRequest,
    ChamadaCursistaResponse,
    MissoesCursistaResponse,
)

logger = logging.getLogger(__name__)

# Chamada de cursistas: coordenador e tutor de comunidade (só a própria),
# coord. geral e administrador (todas). Cursista não tem login.
exigir_cursistas = require_perfil(*PERFIS_CURSISTAS)
router = APIRouter(prefix="/cursistas", tags=["Cursistas"], dependencies=[Depends(exigir_cursistas)])

# Contam para os cursistas só a Formação de Cursistas e o Encontro Querigmático,
# reconhecidos pelo nome (fn_missao_de_cursista, migration 012).

# Cursistas que entram na chamada: os do ano da missão que já passaram pelo encontro
CURSISTA_DA_CHAMADA = """
    c.status IN ('ativo', 'concluido', 'promovido')
    AND c.ano = EXTRACT(YEAR FROM %(data)s::date)
    AND c.id_comunidade = ANY(%(comunidades)s)
"""


def _comunidades(cursor, usuario: UsuarioLogado) -> list[dict]:
    """Comunidades que o usuário vê: todas para coord. geral/administrador, senão a(s) dele."""
    if usuario.tem(*PERFIS_ADMIN):
        cursor.execute("""
            SELECT id_comunidade, nome FROM comunidade
            WHERE tipo = 'cursistas' ORDER BY nome
        """)
    else:
        cursor.execute("""
            SELECT DISTINCT c.id_comunidade, c.nome
            FROM vw_responsaveis_comunidade r
            JOIN comunidade c ON c.id_comunidade = r.id_comunidade AND c.tipo = 'cursistas'
            WHERE r.id_servo = %s
            ORDER BY c.nome
        """, (usuario.id_servo,))
    return cursor.fetchall()


def _missao_da_chamada(cursor, id_missao: int) -> dict:
    """A missão precisa ser de cursista e já ter acontecido (ou ser hoje)."""
    cursor.execute("""
        SELECT id_missao, data, descricao, data > CURRENT_DATE AS futura
        FROM missao
        WHERE id_missao = %s AND fn_missao_de_cursista(descricao)
    """, (id_missao,))
    missao = cursor.fetchone()
    if not missao:
        raise HTTPException(status_code=404, detail="Missão de cursistas não encontrada.")
    if missao["futura"]:
        raise HTTPException(
            status_code=400,
            detail="Essa missão ainda não aconteceu. A chamada só pode ser feita a partir do dia dela."
        )
    return missao


@router.get("/chamada/missoes", response_model=MissoesCursistaResponse)
def listar_missoes(usuario: UsuarioLogado = Depends(exigir_cursistas)):
    """Formações e encontro do ano até hoje, da mais recente para a mais antiga."""
    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            ids = [c["id_comunidade"] for c in _comunidades(cursor, usuario)]
            cursor.execute("""
                SELECT
                    m.id_missao,
                    m.data::text,
                    m.descricao,
                    EXISTS (
                        SELECT 1 FROM frequencia_cursista f
                        JOIN cursista c ON c.id_cursista = f.id_cursista
                        WHERE f.id_missao = m.id_missao AND c.id_comunidade = ANY(%s)
                    ) AS tem_frequencia
                FROM missao m
                WHERE fn_missao_de_cursista(m.descricao)
                  AND m.data <= CURRENT_DATE
                  AND EXTRACT(YEAR FROM m.data) = EXTRACT(YEAR FROM CURRENT_DATE)
                ORDER BY m.data DESC, m.id_missao
            """, (ids,))
            return MissoesCursistaResponse(data=cursor.fetchall())

    except Exception as e:
        logger.error(f"Erro ao buscar missões de cursistas: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")


@router.get("/chamada/{id_missao}", response_model=ChamadaCursistaResponse)
def ver_chamada(id_missao: int, usuario: UsuarioLogado = Depends(exigir_cursistas)):
    """Cursistas de cada comunidade do usuário, com o status já lançado (ou vazio)."""
    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            missao = _missao_da_chamada(cursor, id_missao)
            comunidades = _comunidades(cursor, usuario)
            ids = [c["id_comunidade"] for c in comunidades]

            cursor.execute(f"""
                SELECT c.id_cursista, c.nome, c.id_comunidade, f.status
                FROM cursista c
                LEFT JOIN frequencia_cursista f
                       ON f.id_cursista = c.id_cursista AND f.id_missao = %(id_missao)s
                WHERE {CURSISTA_DA_CHAMADA}
                ORDER BY c.nome
            """, {"id_missao": id_missao, "data": missao["data"], "comunidades": ids})
            cursistas = cursor.fetchall()

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao buscar a chamada de cursistas da missão {id_missao}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return ChamadaCursistaResponse(
        id_missao=missao["id_missao"],
        data=missao["data"].isoformat(),
        descricao=missao["descricao"],
        comunidades=[
            {
                "id_comunidade": com["id_comunidade"],
                "nome": com["nome"],
                "cursistas": [c for c in cursistas if c["id_comunidade"] == com["id_comunidade"]],
            }
            for com in comunidades
        ],
    )


@router.put("/chamada/{id_missao}", response_model=MessageResponse)
def salvar_chamada(
    id_missao: int,
    body: ChamadaCursistaRequest,
    usuario: UsuarioLogado = Depends(exigir_cursistas),
):
    """Lança ou corrige a chamada (só dos cursistas das comunidades do usuário)."""
    status_por_id = {item.id_cursista: item.status.value for item in body.itens}

    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            missao = _missao_da_chamada(cursor, id_missao)
            ids = [c["id_comunidade"] for c in _comunidades(cursor, usuario)]

            cursor.execute(f"""
                SELECT c.id_cursista FROM cursista c
                WHERE c.id_cursista = ANY(%(cursistas)s) AND {CURSISTA_DA_CHAMADA}
            """, {"cursistas": list(status_por_id), "data": missao["data"], "comunidades": ids})
            if len(cursor.fetchall()) != len(status_por_id):
                raise HTTPException(
                    status_code=403,
                    detail="Há cursistas que não são da sua comunidade ou não estão nesta chamada."
                )

            # Não precisa de conn.commit() — o context manager commita automaticamente
            cursor.executemany("""
                INSERT INTO frequencia_cursista (id_cursista, id_missao, status, registrado_por)
                VALUES (%(id_cursista)s, %(id_missao)s, %(status)s, %(usuario)s)
                ON CONFLICT (id_cursista, id_missao) DO UPDATE
                    SET status = EXCLUDED.status, atualizado_por = %(usuario)s
                    WHERE frequencia_cursista.status IS DISTINCT FROM EXCLUDED.status
            """, [
                {"id_cursista": id_cursista, "id_missao": id_missao, "status": status, "usuario": usuario.id}
                for id_cursista, status in status_por_id.items()
            ])

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao salvar a chamada de cursistas da missão {id_missao}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return MessageResponse(message="Chamada salva com sucesso!")
