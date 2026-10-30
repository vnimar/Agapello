import logging
from fastapi import APIRouter, HTTPException, Depends, Response
from ..bd.db import get_connection
import psycopg2.extras
from datetime import date
from ..config.security import PERFIS_ADMIN, exigir_login, require_perfil
from ..schemas.missao_schema import (
    MissaoResponse,
    MissaoCreate,
    MissaoUpdate,
    MissaoImportRequest,
    MissaoImportItem,
    MissaoImportResponse,
)

logger = logging.getLogger(__name__)

# Ver o calendário: qualquer perfil logado. Editar: administrador/coord. geral.
router = APIRouter(prefix="/missao", tags=["Missão"], dependencies=[Depends(exigir_login)])

CAMPOS = "id_missao, data, descricao, horario, local, publico, conta_frequencia, observacao"


def _formatar_missao(missao: dict) -> dict:
    """Converte a linha do banco no formato que o app espera (data ISO, horário HH:MM)."""
    missao = dict(missao)
    if isinstance(missao.get("data"), date):
        missao["data"] = missao["data"].isoformat()
    horario = missao.get("horario")
    missao["horario"] = horario.strftime("%H:%M") if horario else "Horário não definido"
    missao["local"] = missao.get("local") or "Local não definido"
    return missao

@router.get("/", response_model=list[MissaoResponse])
def get_missao():

    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(f"SELECT {CAMPOS} FROM missao ORDER BY data ASC, horario ASC NULLS LAST")
                missoes = cursor.fetchall()

        if not missoes:
            raise HTTPException(status_code=404, detail="Nenhuma missão encontrada.")

        return [_formatar_missao(m) for m in missoes]

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao buscar missões: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")

@router.get("/proxima", response_model=MissaoResponse)
def get_proxima_missao():

    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(f"""
                    SELECT {CAMPOS}
                    FROM missao
                    WHERE data >= CURRENT_DATE
                    ORDER BY data ASC, horario ASC NULLS LAST
                    LIMIT 1
                """)
                missao = cursor.fetchone()

        if not missao:
            raise HTTPException(status_code=404, detail="Nenhuma missão futura encontrada.")

        return _formatar_missao(missao)

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao buscar próxima missão: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")

@router.get("/ultimas", response_model=list[MissaoResponse])
def get_ultimas_missoes():

    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(f"""
                    SELECT {CAMPOS}
                    FROM missao
                    WHERE data <= CURRENT_DATE
                    ORDER BY data DESC
                    LIMIT 3
                """)

                missoes = cursor.fetchall()

        if not missoes:
            raise HTTPException(
                status_code=404,
                detail="Nenhuma missão encontrada."
            )

        return [_formatar_missao(m) for m in missoes]

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao buscar últimas missões: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")

# ── Administração ─────────────────────────────────────────────────────────────

verify_admin = require_perfil(*PERFIS_ADMIN)

@router.post("/", response_model=MissaoResponse, status_code=201, dependencies=[Depends(verify_admin)])
def criar_missao(body: MissaoCreate):

    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(f"""
                    INSERT INTO missao (data, descricao, horario, local, publico, conta_frequencia, observacao)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING {CAMPOS}
                """, (body.data, body.descricao, body.horario, body.local,
                      body.publico, body.conta_frequencia, body.observacao))
                missao = cursor.fetchone()

    except Exception as e:
        logger.error(f"Erro ao criar missão: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")

    return _formatar_missao(missao)

@router.put("/{id_missao}", response_model=MissaoResponse, dependencies=[Depends(verify_admin)])
def atualizar_missao(id_missao: int, body: MissaoUpdate):

    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute(f"""
                    UPDATE missao
                    SET data = %s, descricao = %s, horario = %s, local = %s,
                        publico = %s, conta_frequencia = %s, observacao = %s
                    WHERE id_missao = %s
                    RETURNING {CAMPOS}
                """, (body.data, body.descricao, body.horario, body.local,
                      body.publico, body.conta_frequencia, body.observacao, id_missao))
                missao = cursor.fetchone()

        if not missao:
            raise HTTPException(status_code=404, detail="Missão não encontrada.")

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao atualizar missão {id_missao}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")

    return _formatar_missao(missao)

@router.delete("/{id_missao}", status_code=204, dependencies=[Depends(verify_admin)])
def excluir_missao(id_missao: int):

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                # Missão com chamada registrada não pode sumir: perderia o histórico
                cursor.execute("""
                    SELECT EXISTS (SELECT 1 FROM frequencia WHERE id_missao = %s)
                        OR EXISTS (SELECT 1 FROM frequencia_cursista WHERE id_missao = %s)
                """, (id_missao, id_missao))
                if cursor.fetchone()[0]:
                    raise HTTPException(
                        status_code=409,
                        detail="Esta missão já tem chamada registrada e não pode ser excluída. Edite a data em vez disso."
                    )

                cursor.execute("DELETE FROM missao WHERE id_missao = %s", (id_missao,))
                if cursor.rowcount == 0:
                    raise HTTPException(status_code=404, detail="Missão não encontrada.")

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao excluir missão {id_missao}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")

    return Response(status_code=204)

@router.post("/importar", response_model=MissaoImportResponse, dependencies=[Depends(verify_admin)])
def importar_missoes(body: MissaoImportRequest):
    """
    Importa um calendário inteiro.
    confirmar=false → só valida e devolve a prévia (nada é gravado).
    confirmar=true  → grava as novas; as duplicadas (mesma data + descrição) são ignoradas.
    """

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                datas = list({m.data for m in body.missoes})
                cursor.execute(
                    "SELECT data, lower(descricao) FROM missao WHERE data = ANY(%s)",
                    (datas,)
                )
                existentes = {(d, desc) for d, desc in cursor.fetchall()}

                itens: list[MissaoImportItem] = []
                novas: list[MissaoCreate] = []
                for m in body.missoes:
                    chave = (m.data, m.descricao.lower())
                    duplicada = chave in existentes
                    existentes.add(chave)  # também pega repetidas dentro do próprio arquivo
                    if not duplicada:
                        novas.append(m)
                    itens.append(MissaoImportItem(
                        data=m.data.isoformat(),
                        descricao=m.descricao,
                        horario=m.horario.strftime("%H:%M") if m.horario else None,
                        local=m.local,
                        publico=m.publico,
                        situacao="duplicada" if duplicada else "nova",
                    ))

                if body.confirmar and novas:
                    psycopg2.extras.execute_values(cursor, """
                        INSERT INTO missao (data, descricao, horario, local, publico, conta_frequencia, observacao)
                        VALUES %s
                    """, [(m.data, m.descricao, m.horario, m.local, m.publico,
                           m.conta_frequencia, m.observacao) for m in novas])

    except Exception as e:
        logger.error(f"Erro ao importar missões: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")

    gravadas = len(novas) if body.confirmar else 0
    message = (
        f"{gravadas} missão(ões) importada(s)." if body.confirmar
        else f"Prévia: {len(novas)} nova(s), {len(itens) - len(novas)} duplicada(s)."
    )
    return MissaoImportResponse(message=message, gravadas=gravadas, itens=itens)
