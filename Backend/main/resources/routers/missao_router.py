import difflib
import logging
from fastapi import APIRouter, HTTPException, Depends, File, Form, Request, Response, UploadFile
from ..bd.db import get_connection
import psycopg2.extras
from datetime import date
from ..config.auditoria import fora_do_historico
from ..config.security import PERFIS_ADMIN, exigir_login, require_perfil
from ..importacao.calendario_xlsx import ler_planilha
from ..importacao.pastas_xlsx import PlanilhaInvalida, normalizar
from ..schemas.missao_schema import (
    MissaoResponse,
    MissaoCreate,
    MissaoUpdate,
    MissaoImportItem,
    MissaoImportResponse,
    MissaoContaFrequencia,
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

# Antes do PUT /{id_missao}: senão "conta-frequencia" cairia nele como id
@router.put("/conta-frequencia", dependencies=[Depends(verify_admin)])
def marcar_conta_frequencia(body: MissaoContaFrequencia):
    """
    Todas as missões ficam no calendário; só as que contam entram na chamada,
    na porcentagem e no foguinho. Os registros de chamada já feitos ficam guardados.
    """
    if set(body.ids_conta) & set(body.ids_nao_conta):
        raise HTTPException(status_code=400, detail="A mesma missão não pode contar e não contar.")

    try:
        with get_connection() as conn:
            with conn.cursor() as cursor:
                cursor.execute("""
                    UPDATE missao SET conta_frequencia = (id_missao = ANY(%s))
                    WHERE id_missao = ANY(%s) OR id_missao = ANY(%s)
                """, (body.ids_conta, body.ids_conta, body.ids_nao_conta))
                atualizadas = cursor.rowcount

    except Exception as e:
        logger.error(f"Erro ao marcar missões que contam na frequência: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")

    return {"atualizadas": atualizadas}

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

TAMANHO_MAXIMO = 5 * 1024 * 1024


@router.post("/importar", response_model=MissaoImportResponse, dependencies=[Depends(verify_admin)])
def importar_missoes(
    request: Request,
    arquivo: UploadFile = File(...),
    confirmar: bool = Form(False),
):
    """
    Importa a planilha do calendário (Modelo - Calendário).
    confirmar=false → só a prévia. confirmar=true → grava as novas; as que já
    existem (mesma data e mesmo nome) são ignoradas. Com qualquer erro, nada é gravado.
    """
    conteudo = arquivo.file.read(TAMANHO_MAXIMO + 1)
    if len(conteudo) > TAMANHO_MAXIMO:
        raise HTTPException(status_code=413, detail="Arquivo grande demais (máximo 5 MB).")
    try:
        lidas = ler_planilha(conteudo)
    except PlanilhaInvalida as e:
        raise HTTPException(status_code=422, detail=str(e))

    ano_atual = date.today().year
    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute("SELECT DISTINCT descricao FROM missao")
            # Nome normalizado → como está escrito no calendário
            conhecidos = {normalizar(d): d for (d,) in cursor.fetchall()}
            datas = list({m.data for m in lidas if m.data})
            cursor.execute("SELECT data, descricao FROM missao WHERE data = ANY(%s)", (datas,))
            existentes = {(d, normalizar(desc)) for d, desc in cursor.fetchall()}

            itens: list[MissaoImportItem] = []
            erros: list[str] = []
            avisos: list[str] = []
            novas = []
            vistos: dict[tuple, int] = {}
            for m in lidas:
                chave_nome = normalizar(m.descricao)
                erro = m.erro
                if not erro and not (ano_atual - 1 <= m.data.year <= ano_atual + 2):
                    erro = f"ano {m.data.year} fora do esperado ({ano_atual - 1} a {ano_atual + 2})"

                situacao = "erro" if erro else "nova"
                nome_novo = False
                item_avisos = list(m.avisos)
                if not erro:
                    chave = (m.data, chave_nome)
                    if chave in vistos:
                        situacao = "duplicada"
                        item_avisos.append(f"repetida na planilha (linha {vistos[chave]})")
                    elif chave in existentes:
                        situacao = "duplicada"
                    vistos.setdefault(chave, m.linha)

                    if chave_nome not in conhecidos:
                        nome_novo = True
                        parecidos = difflib.get_close_matches(chave_nome, list(conhecidos), n=1, cutoff=0.8)
                        if parecidos:
                            item_avisos.append(f'nome parecido com "{conhecidos[parecidos[0]]}": '
                                               "se for a mesma missão, use o mesmo nome")
                    if situacao == "nova":
                        novas.append(m)

                if erro:
                    erros.append(f"Linha {m.linha} ({m.descricao or 'sem nome'}): {erro}.")
                avisos += [f"Linha {m.linha} ({m.descricao}): {a}." for a in item_avisos]
                itens.append(MissaoImportItem(
                    linha=m.linha,
                    data=m.data.isoformat() if m.data else None,
                    descricao=m.descricao,
                    horario=m.horario.strftime("%H:%M") if m.horario else None,
                    local=m.local,
                    publico=m.publico,
                    conta_frequencia=m.conta_frequencia,
                    observacao=m.observacao,
                    situacao=situacao,
                    erro=erro,
                    avisos=item_avisos,
                    nome_novo=nome_novo,
                ))

            gravar = confirmar and not erros and novas
            if gravar:
                psycopg2.extras.execute_values(cursor, """
                    INSERT INTO missao (data, descricao, horario, local, publico, conta_frequencia, observacao)
                    VALUES %s
                """, [(m.data, m.descricao, m.horario, m.local, m.publico,
                       m.conta_frequencia, m.observacao) for m in novas])

    except Exception as e:
        logger.error(f"Erro ao importar missões: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")

    gravadas = len(novas) if gravar else 0
    if not gravadas:
        fora_do_historico(request)
    duplicadas = sum(1 for i in itens if i.situacao == "duplicada")
    if erros:
        message = f"{len(erros)} linha(s) com erro: corrija a planilha. Nada foi gravado."
    elif confirmar:
        message = f"{gravadas} missão(ões) gravada(s)."
    else:
        message = f"{len(novas)} missão(ões) nova(s)"
        message += f", {duplicadas} já no calendário (ignoradas)." if duplicadas else "."
    return MissaoImportResponse(message=message, gravadas=gravadas, novas=len(novas), duplicadas=duplicadas,
                                erros=erros, avisos=avisos, itens=itens)
