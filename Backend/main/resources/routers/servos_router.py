import logging
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from ..bd.db import get_connection
import psycopg2
import psycopg2.extras
import psycopg2.errors
from ..schemas.servo_schema import ServoListItem, ServoDetail, ServoStatusUpdate
from ..schemas.auth_schema import UsuarioLogado
from ..config.security import PERFIS_ADMIN, PERFIS_COORD_SERVOS, exigir_login, exigir_coord_servos, require_perfil

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/servos", tags=["Servos"])

@router.get("/", response_model=list[ServoListItem], dependencies=[Depends(exigir_coord_servos)])
# Sem a barra também: o redirect 307 do FastAPI sai como http:// no Render e o app
# perde o token ao segui-lo (versões antigas do app chamam "/servos")
@router.get("", response_model=list[ServoListItem], dependencies=[Depends(exigir_coord_servos)], include_in_schema=False)
def listar_servos():

    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
               SELECT s.id_servo AS id,
                      s.nome,
                      s.telefone,
                      s.status,
                      s.ano_ingresso,
                      COALESCE(
                              json_agg(DISTINCT p.nome) FILTER(WHERE p.nome IS NOT NULL),
                              '[]'
                      ) AS pastas
               FROM servo s
                        -- Só as pastas do ano atual (servo_pasta guarda o histórico de todos os anos)
                        LEFT JOIN servo_pasta sp ON sp.id_servo = s.id_servo
                                                AND sp.ano = EXTRACT(YEAR FROM CURRENT_DATE)
                        LEFT JOIN pasta p ON p.id_pasta = sp.id_pasta
               GROUP BY s.id_servo
               ORDER BY s.nome
           """)
            servos = cursor.fetchall()

        return [ServoListItem(**dict(s)) for s in servos]

    except psycopg2.Error as e:
        logger.error(f"Erro ao listar servos: {e}")
        raise HTTPException(status_code=500, detail="Erro ao buscar servos.")


@router.get("/{servo_id}", response_model=ServoDetail)
def get_servo_by_id(
    servo_id: int,
    usuario: Optional[UsuarioLogado] = Depends(exigir_login),
):
    # Quem não cuida dos servos só vê o próprio cadastro
    if usuario and not usuario.tem(*PERFIS_COORD_SERVOS) and usuario.id_servo != servo_id:
        raise HTTPException(status_code=403, detail="Seu perfil não tem acesso a esta função.")

    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute(
                "SELECT id_servo, nome, telefone, status, ano_ingresso FROM servo WHERE id_servo = %s",
                (servo_id,)
            )
            servo = cursor.fetchone()

        if not servo:
            raise HTTPException(status_code=404, detail="Servo não encontrado.")

        return ServoDetail(
            id=servo[0],
            nome=servo[1],
            telefone=servo[2],
            status=servo[3],
            ano_ingresso=servo[4],
        )

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao buscar servo {servo_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")


# Inativar/reativar: só coord. geral e administrador
@router.put("/{servo_id}/status", response_model=ServoDetail)
def alterar_status(
    servo_id: int,
    body: ServoStatusUpdate,
    usuario: UsuarioLogado = Depends(require_perfil(*PERFIS_ADMIN)),
):
    """
    Ninguém é excluído: quem sai fica Inativo (some da chamada e perde o acesso)
    e a saída fica em servo_afastamento. Ao voltar, o afastamento é fechado.
    """
    motivo = (body.motivo or "").strip() or None

    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute("SELECT status FROM servo WHERE id_servo = %s FOR UPDATE", (servo_id,))
            linha = cursor.fetchone()
            if not linha:
                raise HTTPException(status_code=404, detail="Servo não encontrado.")
            if linha[0] == body.status:
                raise HTTPException(status_code=400, detail=f"O servo já está {body.status.lower()}.")

            if body.status == "Inativo":
                cursor.execute("""
                    INSERT INTO servo_afastamento (id_servo, data_saida, motivo, registrado_por)
                    VALUES (%s, CURRENT_DATE, %s, %s)
                """, (servo_id, motivo, usuario.id))
            else:
                # A regra dos 2 anos é checada pelo banco (afastamento_prazo_retorno_check)
                cursor.execute("""
                    UPDATE servo_afastamento SET data_retorno = CURRENT_DATE
                    WHERE id_servo = %s AND data_retorno IS NULL
                """, (servo_id,))

            cursor.execute("""
                UPDATE servo SET status = %s WHERE id_servo = %s
                RETURNING id_servo, nome, telefone, status, ano_ingresso
            """, (body.status, servo_id))
            servo = cursor.fetchone()

    except HTTPException:
        raise

    except psycopg2.errors.CheckViolation:
        raise HTTPException(
            status_code=400,
            detail="Passou o prazo de 2 anos desde a saída. O retorno precisa ser tratado com a coordenação."
        )

    except Exception as e:
        logger.error(f"Erro ao alterar status do servo {servo_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return ServoDetail(
        id=servo[0],
        nome=servo[1],
        telefone=servo[2],
        status=servo[3],
        ano_ingresso=servo[4],
    )
