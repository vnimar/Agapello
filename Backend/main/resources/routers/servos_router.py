import logging
from datetime import date
from typing import Optional
from fastapi import APIRouter, HTTPException, Depends
from ..bd.db import get_connection
import psycopg2
import psycopg2.extras
from ..schemas.servo_schema import (
    ExcluirServos, InativoParaRevisao, MarcarApostolado, ServoDadosUpdate, ServoDetail, ServoListItem,
    ServoParaApostolado, ServoStatusUpdate, SubidaApostolado,
)
from ..schemas.auth_schema import UsuarioLogado
from ..config.security import (
    PERFIS_ADMIN, PERFIS_COORD_SERVOS, exigir_login, exigir_coord_servos, get_current_user, require_admin,
    require_perfil,
)
from ..virada import subir_para_apostolado

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/servos", tags=["Servos"])

# Colunas do ServoDetail, na ordem de _detalhe()
COLUNAS_DETALHE = """id_servo, nome, telefone, status, ano_ingresso,
                     email, endereco, data_nascimento, fn_idade(data_nascimento),
                     apelido, responsavel_nome, responsavel_telefone"""

# Campos que o PUT /dados grava (os de contato + apelido e responsável);
# o PUT /cursistas/{id}/dados usa os mesmos
CAMPOS_DADOS = ("telefone", "email", "endereco", "data_nascimento",
                "apelido", "responsavel_nome", "responsavel_telefone")


# Inativo há mais de 2 anos: entra na revisão anual (e só volta como exceção)
PRAZO_RETORNO = "INTERVAL '2 years'"


def _detalhe(servo) -> ServoDetail:
    return ServoDetail(
        id=servo[0],
        nome=servo[1],
        telefone=servo[2],
        status=servo[3],
        ano_ingresso=servo[4],
        email=servo[5],
        endereco=servo[6],
        data_nascimento=servo[7],
        idade=servo[8],
        apelido=servo[9],
        responsavel_nome=servo[10],
        responsavel_telefone=servo[11],
    )

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
                      s.apelido,
                      s.telefone,
                      s.email,
                      s.endereco,
                      s.data_nascimento,
                      fn_idade(s.data_nascimento) AS idade,
                      s.responsavel_nome,
                      s.responsavel_telefone,
                      -- Quem subiu para o apostolado sai das listas do discipulado,
                      -- mas continua com o nome nas chamadas antigas
                      CASE WHEN s.area = 'apostolado' THEN 'Apostolado' ELSE s.status END AS status,
                      s.ano_ingresso,
                      a.data_saida,
                      COALESCE(
                              json_agg(DISTINCT p.nome) FILTER(WHERE p.nome IS NOT NULL),
                              '[]'
                      ) AS pastas
               FROM servo s
                        -- Só as pastas do ano atual (servo_pasta guarda o histórico de todos os anos)
                        LEFT JOIN servo_pasta sp ON sp.id_servo = s.id_servo
                                                AND sp.ano = EXTRACT(YEAR FROM CURRENT_DATE)
                        LEFT JOIN pasta p ON p.id_pasta = sp.id_pasta
                        LEFT JOIN servo_afastamento a ON a.id_servo = s.id_servo AND a.data_retorno IS NULL
               -- Excluídos vêm junto (status 'Excluido') para as chamadas antigas
               -- continuarem com o nome; as telas tiram eles das listas.
               -- Aguardando (cursista com pasta do ano que vem) só aparece na virada.
               WHERE s.status <> 'Aguardando'
               GROUP BY s.id_servo, a.data_saida
               -- Na tela vale o apelido (é como se conhecem)
               ORDER BY COALESCE(s.apelido, s.nome), s.nome
           """)
            servos = cursor.fetchall()

        return [ServoListItem(**dict(s)) for s in servos]

    except psycopg2.Error as e:
        logger.error(f"Erro ao listar servos: {e}")
        raise HTTPException(status_code=500, detail="Erro ao buscar servos.")


# ── Revisão anual de inativos (admin e coord. geral) ─────────────────────────

SQL_ELEGIVEIS = f"""
    SELECT s.id_servo, s.nome, a.data_saida, (u.id_usuario IS NOT NULL) AS tem_login
    FROM servo s
    JOIN servo_afastamento a ON a.id_servo = s.id_servo AND a.data_retorno IS NULL
    LEFT JOIN usuario u ON u.id_servo = s.id_servo
    WHERE s.status = 'Inativo'
      AND a.data_saida <= CURRENT_DATE - {PRAZO_RETORNO}
"""


@router.get("/revisao-inativos", response_model=list[InativoParaRevisao],
            dependencies=[Depends(require_perfil(*PERFIS_ADMIN))])
def listar_revisao_inativos():
    """Quem está inativo há mais de 2 anos (candidatos à exclusão)."""
    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute(SQL_ELEGIVEIS + " ORDER BY a.data_saida, s.nome")
            linhas = cursor.fetchall()
    except Exception as e:
        logger.error(f"Erro ao listar inativos para revisão: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return [InativoParaRevisao(id=i, nome=n, data_saida=d, tem_login=l) for i, n, d, l in linhas]


@router.post("/excluir", dependencies=[Depends(require_perfil(*PERFIS_ADMIN))])
def excluir_servos(body: ExcluirServos):
    """
    Exclui os servos escolhidos na revisão. A linha fica (nome, frequências e
    pastas antigas continuam nas chamadas), mas some de tudo e perde os dados
    pessoais: contato, nascimento, foto, motivo da saída e a conta de login.
    """
    ids = sorted(set(body.ids))
    if not ids:
        raise HTTPException(status_code=400, detail="Escolha pelo menos um servo.")

    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute(SQL_ELEGIVEIS + " AND s.id_servo = ANY(%s) FOR UPDATE OF s", (ids,))
            elegiveis = {linha[0] for linha in cursor.fetchall()}
            if any(i not in elegiveis for i in ids):
                raise HTTPException(
                    status_code=400,
                    detail="Só dá para excluir quem está inativo há mais de 2 anos. Atualize a lista.",
                )

            cursor.execute("""
                UPDATE servo
                SET status = 'Excluido', excluido_em = now(),
                    telefone = NULL, email = NULL, endereco = NULL, data_nascimento = NULL, foto_url = NULL,
                    responsavel_nome = NULL, responsavel_telefone = NULL
                WHERE id_servo = ANY(%s)
            """, (ids,))
            cursor.execute("UPDATE servo_afastamento SET motivo = NULL WHERE id_servo = ANY(%s)", (ids,))
            # A conta fica (é referenciada como autora de registros), mas sem email, senha nem acesso
            cursor.execute("""
                UPDATE usuario
                SET ativo = false, senha_hash = NULL, trocar_senha = false, perfil = 'servo',
                    email = 'excluido.' || id_usuario || '@agapello.invalid'
                WHERE id_servo = ANY(%s)
            """, (ids,))

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao excluir servos {ids}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    total = len(ids)
    plural = "s" if total > 1 else ""
    return {"message": f"{total} servo{plural} excluído{plural}.", "excluidos": total}


# ── Subida para o apostolado (administrador) ─────────────────────────────────
#
# O convite é feito durante um ano para o seguinte, e só pode ser convidado quem
# tem 3 anos completos de Ágape (1 como cursista + 2 como servo) no momento do
# convite: para subir em X, ano de ingresso até X - 4. O app só avisa.

def _anos_da_subida() -> tuple[int, int]:
    ano_atual = date.today().year
    return ano_atual, ano_atual + 1


@router.get("/apostolado", response_model=SubidaApostolado, dependencies=[Depends(require_admin)])
def listar_subida_apostolado(ano: Optional[int] = None):
    """Servos ativos do discipulado, com quem já está marcado para subir em `ano`."""
    ano = ano or _anos_da_subida()[1]
    if ano not in _anos_da_subida():
        raise HTTPException(status_code=422, detail="Só dá para marcar a subida do ano atual ou do seguinte.")
    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute("""
                SELECT id_servo, nome, apelido, ano_ingresso, sobe_apostolado_em = %s
                FROM servo
                WHERE status = 'Ativo' AND area = 'discipulado'
                ORDER BY COALESCE(apelido, nome), nome
            """, (ano,))
            servos = cursor.fetchall()
            cursor.execute("""
                SELECT COALESCE(apelido, nome) FROM servo
                WHERE area = 'apostolado' AND status = 'Ativo' ORDER BY 1
            """)
            no_apostolado = [n for (n,) in cursor.fetchall()]
    except Exception as e:
        logger.error(f"Erro ao listar a subida para o apostolado: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return SubidaApostolado(
        ano=ano,
        servos=[ServoParaApostolado(
            id=i, nome=n, apelido=a, ano_ingresso=ing,
            elegivel=bool(ing and 0 < ing <= ano - 4), marcado=bool(m),
        ) for i, n, a, ing, m in servos],
        no_apostolado=no_apostolado,
    )


@router.put("/apostolado", dependencies=[Depends(require_admin)])
def marcar_subida_apostolado(body: MarcarApostolado):
    """
    Grava quem sobe em `ano` (substitui a marcação desse ano). Ano seguinte:
    vale na virada de 1º de janeiro. Ano atual: vale na hora.
    """
    ano_atual, ano_seguinte = _anos_da_subida()
    if body.ano not in (ano_atual, ano_seguinte):
        raise HTTPException(status_code=422, detail="Só dá para marcar a subida do ano atual ou do seguinte.")
    ids = sorted(set(body.ids))
    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute("""
                SELECT count(*) FROM servo
                WHERE id_servo = ANY(%s) AND status = 'Ativo' AND area = 'discipulado'
            """, (ids,))
            if cursor.fetchone()[0] != len(ids):
                raise HTTPException(status_code=400, detail="Só servos ativos do discipulado podem subir.")

            cursor.execute("UPDATE servo SET sobe_apostolado_em = NULL WHERE sobe_apostolado_em = %s", (body.ano,))
            cursor.execute("UPDATE servo SET sobe_apostolado_em = %s WHERE id_servo = ANY(%s)", (body.ano, ids))
            if body.ano == ano_atual:
                subir_para_apostolado(cursor, body.ano)

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao marcar a subida para o apostolado: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    total = len(ids)
    quando = "agora" if body.ano == ano_atual else f"em 1º de janeiro de {body.ano}"
    if not total:
        return {"message": f"Ninguém marcado para subir em {body.ano}.", "marcados": 0}
    plural = "s" if total > 1 else ""
    return {"message": f"{total} servo{plural} sobe{'m' if total > 1 else ''} para o apostolado {quando}.",
            "marcados": total}


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
                f"SELECT {COLUNAS_DETALHE} FROM servo WHERE id_servo = %s",
                (servo_id,)
            )
            servo = cursor.fetchone()

        if not servo:
            raise HTTPException(status_code=404, detail="Servo não encontrado.")

        return _detalhe(servo)

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao buscar servo {servo_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")


# Dados de contato: o próprio servo se atualiza; admin e coord. geral editam qualquer um
@router.put("/{servo_id}/dados", response_model=ServoDetail)
def editar_dados(
    servo_id: int,
    body: ServoDadosUpdate,
    usuario: UsuarioLogado = Depends(get_current_user),
):
    if usuario.id_servo != servo_id and not usuario.tem(*PERFIS_ADMIN):
        raise HTTPException(status_code=403, detail="Você só pode editar os seus próprios dados.")

    # Só os campos enviados: versões antigas do app não mandam apelido nem
    # responsável, e isso não pode apagar o que já está gravado
    campos = [c for c in CAMPOS_DADOS if c in body.model_fields_set]

    try:
        with get_connection() as conn, conn.cursor() as cursor:
            if campos:
                cursor.execute(f"""
                    UPDATE servo SET {", ".join(f"{c} = %s" for c in campos)}
                    WHERE id_servo = %s
                    RETURNING {COLUNAS_DETALHE}
                """, (*(getattr(body, c) for c in campos), servo_id))
            else:
                cursor.execute(f"SELECT {COLUNAS_DETALHE} FROM servo WHERE id_servo = %s", (servo_id,))
            servo = cursor.fetchone()

    except Exception as e:
        logger.error(f"Erro ao editar dados do servo {servo_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    if not servo:
        raise HTTPException(status_code=404, detail="Servo não encontrado.")
    return _detalhe(servo)


# Inativar/reativar: só coord. geral e administrador
@router.put("/{servo_id}/status", response_model=ServoDetail)
def alterar_status(
    servo_id: int,
    body: ServoStatusUpdate,
    usuario: UsuarioLogado = Depends(require_perfil(*PERFIS_ADMIN)),
):
    """
    Quem sai fica Inativo (some da chamada e perde o acesso) e a saída fica em
    servo_afastamento. Ao voltar, o afastamento é fechado. Passados 2 anos, a
    volta só como exceção confirmada; a exclusão é feita na revisão anual.
    """
    motivo = (body.motivo or "").strip() or None

    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute("SELECT status FROM servo WHERE id_servo = %s FOR UPDATE", (servo_id,))
            linha = cursor.fetchone()
            if not linha:
                raise HTTPException(status_code=404, detail="Servo não encontrado.")
            if linha[0] == "Excluido":
                raise HTTPException(status_code=400, detail="Servo excluído não volta: entra de novo como cursista.")
            if linha[0] == body.status:
                raise HTTPException(status_code=400, detail=f"O servo já está {body.status.lower()}.")

            if body.status == "Inativo":
                cursor.execute("""
                    INSERT INTO servo_afastamento (id_servo, data_saida, motivo, registrado_por)
                    VALUES (%s, CURRENT_DATE, %s, %s)
                """, (servo_id, motivo, usuario.id))
            else:
                cursor.execute(f"""
                    SELECT 1 FROM servo_afastamento
                    WHERE id_servo = %s AND data_retorno IS NULL
                      AND data_saida <= CURRENT_DATE - {PRAZO_RETORNO}
                """, (servo_id,))
                if cursor.fetchone() and not body.excecao:
                    raise HTTPException(
                        status_code=409,
                        detail="Passou o prazo de 2 anos desde a saída. Só dá para reativar como exceção.",
                    )
                cursor.execute("""
                    UPDATE servo_afastamento SET data_retorno = CURRENT_DATE
                    WHERE id_servo = %s AND data_retorno IS NULL
                """, (servo_id,))

            cursor.execute(f"""
                UPDATE servo SET status = %s WHERE id_servo = %s
                RETURNING {COLUNAS_DETALHE}
            """, (body.status, servo_id))
            servo = cursor.fetchone()

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao alterar status do servo {servo_id}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return _detalhe(servo)
