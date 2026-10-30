import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from ..bd.db import get_connection
import psycopg2.extras
from datetime import date
from ..config.security import exigir_coord_servos
from ..schemas.auth_schema import UsuarioLogado
from ..schemas.frequencia_schema import (
    FrequenciaCreate,
    FrequenciaUpdate,
    FrequenciaResponse,
    FrequenciaEmptyResponse,
    MessageResponse,
    FrequenciaServosResponse,
    MissoesComFrequenciaResponse,
    MissaoComFrequencia,
)

logger = logging.getLogger(__name__)

# Chamada de servos: coord. formação/vivência, coord. geral e administrador
router = APIRouter(prefix="/frequencia", tags=["Frequência"], dependencies=[Depends(exigir_coord_servos)])


def _verificar_missao(cursor, id_missao: int):
    """A missão precisa existir e já ter acontecido (ou ser hoje)."""
    cursor.execute(
        "SELECT data > CURRENT_DATE FROM missao WHERE id_missao = %s",
        (id_missao,)
    )
    linha = cursor.fetchone()
    if not linha:
        raise HTTPException(status_code=404, detail="Missão não encontrada.")
    if linha[0]:
        raise HTTPException(
            status_code=400,
            detail="Essa missão ainda não aconteceu. A frequência só pode ser lançada a partir do dia dela."
        )

@router.post("/register", response_model=MessageResponse, status_code=201)
def register_frequencia(
    body: FrequenciaCreate,
    usuario: Optional[UsuarioLogado] = Depends(exigir_coord_servos),
):

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:

                # 1. Verificar se a missão existe e já chegou o dia dela
                _verificar_missao(cursor, body.id_missao)

                # 2. Verificar duplicidade
                cursor.execute("""
                    SELECT id_frequencia FROM frequencia
                    WHERE id_servo = %s AND id_missao = %s
                """, (body.id_servo, body.id_missao))

                if cursor.fetchone():
                    raise HTTPException(status_code=409, detail="Registro já existe. Use edição.")

                # 3. Inserir
                # Não precisa de conn.commit() — o context manager commita automaticamente
                cursor.execute("""
                    INSERT INTO frequencia (id_servo, id_missao, status, data, registrado_por)
                    VALUES (%s, %s, %s, %s, %s)
                """, (body.id_servo, body.id_missao, body.status, date.today(),
                      usuario.id if usuario else None))

    except HTTPException:
        raise  # repassa HTTPException sem virar 500

    except Exception as e:
        # Não precisa de conn.rollback() — o context manager reverte automaticamente
        logger.error(f"Erro ao registrar frequência: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return MessageResponse(message="Frequência registrada com sucesso!")

@router.get("/servos", response_model=FrequenciaServosResponse)
def get_frequencia_by_servo():
    # Frequência anual: reinicia em 1º de janeiro. Mesma regra do /auth/me/resumo:
    # só missões do ano que já aconteceram e que contam frequência.

    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute("SELECT EXTRACT(YEAR FROM CURRENT_DATE)::int AS ano")
                ano = cursor.fetchone()["ano"]

                cursor.execute("""
                    SELECT
                        s.id_servo,
                        s.nome,
                        COUNT(CASE WHEN f.status = 'Presente'    THEN 1 END) AS presente,
                        COUNT(CASE WHEN f.status = 'Justificada' THEN 1 END) AS justificada,
                        COUNT(CASE WHEN f.status = 'Falta'       THEN 1 END) AS falta,
                        ROUND(
                            COUNT(*) FILTER (WHERE f.status IN ('Presente', 'Justificada')) * 100.0
                            / NULLIF(COUNT(f.id_frequencia), 0),
                        2) AS percentual_presenca
                    FROM servo s
                    LEFT JOIN (
                        frequencia f
                        JOIN missao m ON m.id_missao = f.id_missao
                                     AND m.conta_frequencia
                                     AND m.data <= CURRENT_DATE
                                     AND EXTRACT(YEAR FROM m.data) = %s
                    ) ON f.id_servo = s.id_servo
                    GROUP BY s.id_servo, s.nome
                    ORDER BY s.nome
                """, (ano,))
                dados = cursor.fetchall()

    except Exception as e:
        logger.error(f"Erro ao buscar resumo de frequência: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return FrequenciaServosResponse(message="Resumo de frequência", ano=ano, data=dados)

@router.get("/missoes", response_model=MissoesComFrequenciaResponse)
def get_missoes_com_frequencia():
    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
                cursor.execute("""
                    SELECT
                        m.id_missao,
                        m.data::text,
                        m.descricao,
                        EXISTS (
                            SELECT 1 FROM frequencia f
                            WHERE f.id_missao = m.id_missao
                        ) AS tem_frequencia
                    FROM missao m
                    -- Só as que já aconteceram (ou são hoje): a futura não recebe chamada
                    WHERE m.data <= CURRENT_DATE
                    ORDER BY m.data DESC, m.id_missao
                """)
                return MissoesComFrequenciaResponse(data=cursor.fetchall())

    except Exception as e:
        logger.error(f"Erro ao buscar missões com frequência: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

@router.get("/missao/{id_missao}", response_model=FrequenciaResponse | FrequenciaEmptyResponse)
def get_frequencia(id_missao: int):

    try:
        with get_connection() as conn:
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:

                cursor.execute(
                    "SELECT data, descricao FROM missao WHERE id_missao = %s",
                    (id_missao,)
                )
                missao = cursor.fetchone()

                if not missao:
                    raise HTTPException(status_code=404, detail="Missão não encontrada.")

                cursor.execute("""
                    SELECT id_frequencia FROM frequencia
                    WHERE id_missao = %s LIMIT 1
                """, (id_missao,))

                existe = cursor.fetchone()

                if existe is None:
                    return FrequenciaEmptyResponse(
                        message="Missão existe, mas ainda não há registros de frequência.",
                        data_missao=missao["data"].isoformat(),
                        descricao=missao["descricao"],
                    )

                cursor.execute("""
                    SELECT s.id_servo, s.nome, f.status
                    FROM frequencia f
                    JOIN servo s ON s.id_servo = f.id_servo
                    WHERE f.id_missao = %s
                    ORDER BY s.nome
                """, (id_missao,))

                dados = cursor.fetchall()

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao buscar frequência da missão {id_missao}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return FrequenciaResponse(
        message="Frequência encontrada.",
        data_missao=missao["data"].isoformat(),
        descricao=missao["descricao"],
        data=[dict(d) for d in dados],
    )

@router.put("/update", response_model=MessageResponse)
def update_frequencia(
    body: FrequenciaUpdate,
    usuario: Optional[UsuarioLogado] = Depends(exigir_coord_servos),
):
    id_usuario = usuario.id if usuario else None

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:

                _verificar_missao(cursor, body.id_missao)

                cursor.execute("""
                    UPDATE frequencia
                    SET status = %s, atualizado_por = %s
                    WHERE id_servo = %s AND id_missao = %s
                """, (body.status, id_usuario, body.id_servo, body.id_missao))

                # Servo sem registro nessa missão (ex.: cadastrado depois da chamada)
                if cursor.rowcount == 0:
                    cursor.execute("""
                        INSERT INTO frequencia (id_servo, id_missao, status, data, registrado_por)
                        VALUES (%s, %s, %s, %s, %s)
                    """, (body.id_servo, body.id_missao, body.status, date.today(), id_usuario))

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao atualizar frequência: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return MessageResponse(message="Frequência atualizada com sucesso!")