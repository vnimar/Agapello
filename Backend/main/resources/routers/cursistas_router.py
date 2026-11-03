import difflib
import logging
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, File, Form, Request, UploadFile
from ..bd.db import get_connection
import psycopg2.extras
from ..config.auditoria import fora_do_historico
from ..config.security import PERFIS_ADMIN, PERFIS_CURSISTAS, require_perfil
from ..importacao.cursistas_xlsx import ler_planilha
from ..importacao.pastas_xlsx import PlanilhaInvalida, normalizar
from ..schemas.auth_schema import UsuarioLogado
from ..schemas.frequencia_schema import MessageResponse
from ..schemas.cursista_schema import (
    ChamadaCursistaRequest,
    ChamadaCursistaResponse,
    CursistaImportado,
    CursistaItem,
    ExcluirCursistas,
    FaltosoEncontro,
    FrequenciaCursistasResponse,
    ImportacaoCursistasResponse,
    MissoesCursistaResponse,
)

logger = logging.getLogger(__name__)

# Chamada de cursistas: coordenador e tutor de comunidade (só a própria),
# coord. geral e administrador (todas). Cursista não tem login.
exigir_cursistas = require_perfil(*PERFIS_CURSISTAS)
router = APIRouter(prefix="/cursistas", tags=["Cursistas"], dependencies=[Depends(exigir_cursistas)])

# Contam para os cursistas só a Formação de Cursistas, o Encontro Querigmático e a
# Confraternização, reconhecidos pelo nome (fn_missao_de_cursista, migrations 012/013),
# e desde que a missão conte na frequência.

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
        WHERE id_missao = %s AND fn_missao_de_cursista(descricao) AND conta_frequencia
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
    """Formações, encontro e confraternizações do ano até hoje, da mais recente para a mais antiga."""
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
                  AND m.conta_frequencia
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


# ── Lista com a frequência do ano ────────────────────────────────────────────

@router.get("/frequencia", response_model=FrequenciaCursistasResponse)
def frequencia_cursistas(usuario: UsuarioLogado = Depends(exigir_cursistas)):
    """
    % do ano de cada cursista das comunidades do usuário. Mesma regra da chamada:
    só formação, encontro e confraternização que contam e já aconteceram.
    A % vale só no ano de cursista (reinicia em 1º de janeiro).
    """
    ano = date.today().year
    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            comunidades = _comunidades(cursor, usuario)
            cursor.execute("""
                SELECT c.id_cursista, c.nome, c.id_comunidade,
                       COUNT(*) FILTER (WHERE f.status = 'Presente')    AS presente,
                       COUNT(*) FILTER (WHERE f.status = 'Justificada') AS justificada,
                       COUNT(*) FILTER (WHERE f.status = 'Falta')       AS falta,
                       ROUND(COUNT(*) FILTER (WHERE f.status IN ('Presente', 'Justificada')) * 100.0
                             / NULLIF(COUNT(f.id_frequencia_cursista), 0), 2) AS percentual_presenca
                FROM cursista c
                LEFT JOIN (
                    frequencia_cursista f
                    JOIN missao m ON m.id_missao = f.id_missao
                                 AND fn_missao_de_cursista(m.descricao)
                                 AND m.conta_frequencia
                                 AND m.data <= CURRENT_DATE
                                 AND EXTRACT(YEAR FROM m.data) = %(ano)s
                ) ON f.id_cursista = c.id_cursista
                WHERE c.ano = %(ano)s
                  AND c.status IN ('ativo', 'concluido', 'promovido')
                  AND c.id_comunidade = ANY(%(comunidades)s)
                GROUP BY c.id_cursista, c.nome, c.id_comunidade
                ORDER BY c.nome
            """, {"ano": ano, "comunidades": [c["id_comunidade"] for c in comunidades]})
            cursistas = cursor.fetchall()

    except Exception as e:
        logger.error(f"Erro ao buscar a frequência dos cursistas: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return FrequenciaCursistasResponse(
        ano=ano,
        comunidades=[
            {
                "id_comunidade": com["id_comunidade"],
                "nome": com["nome"],
                "cursistas": [c for c in cursistas if c["id_comunidade"] == com["id_comunidade"]],
            }
            for com in comunidades
        ],
    )


# ── Gestão dos cursistas (admin e coord. geral) ──────────────────────────────
# O cursista entra no sistema pela planilha do encontro (antes ou no 1º dia),
# já na comunidade. Quem falta ao encontro, desiste ou foi lançado por engano
# é apagado por completo (com as presenças).

exigir_admin = require_perfil(*PERFIS_ADMIN)
TAMANHO_MAXIMO = 5 * 1024 * 1024

# Cursista que ainda não virou servo (pode ser apagado)
STATUS_CURSISTA = ("ativo", "concluido")

# Os dias do encontro são as missões "Encontro Querigmático" do ano
SQL_DIAS_ENCONTRO = """
    SELECT id_missao FROM missao
    WHERE fn_missao_de_cursista(descricao)
      AND lower(descricao) ~ '^encontro querigm'
      AND EXTRACT(YEAR FROM data) = %(ano)s
"""


def _validar_ano(ano: int):
    ano_atual = date.today().year
    if ano not in (ano_atual, ano_atual + 1):
        raise HTTPException(status_code=422, detail=f"Só dá para usar {ano_atual} ou {ano_atual + 1}.")


@router.get("/", response_model=list[CursistaItem], dependencies=[Depends(exigir_admin)])
@router.get("", response_model=list[CursistaItem], dependencies=[Depends(exigir_admin)], include_in_schema=False)
def listar_cursistas(ano: Optional[int] = None):
    """Cursistas do ano (padrão: o atual), já no sistema."""
    ano = ano or date.today().year
    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute("""
                SELECT c.id_cursista, c.nome, c.id_comunidade, co.nome AS comunidade, c.status,
                       c.telefone, c.email, c.endereco, c.data_nascimento,
                       fn_idade(c.data_nascimento) AS idade
                FROM cursista c
                LEFT JOIN comunidade co ON co.id_comunidade = c.id_comunidade
                WHERE c.ano = %s AND c.status IN ('ativo', 'concluido', 'promovido')
                ORDER BY co.nome, c.nome
            """, (ano,))
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Erro ao listar cursistas: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")


def _achar_comunidade(texto: str, comunidades: dict[str, tuple[int, str]]) -> tuple[Optional[int], Optional[str], bool]:
    """(id, nome, conferir). Aceita "Kairos", "Comunidade Kairós"; letra trocada pede conferência."""
    chave = normalizar(texto)
    if not chave:
        return None, None, False
    for nome_norm, (id_com, nome) in comunidades.items():
        if chave == nome_norm or f" {nome_norm} " in f" {chave} ":
            return id_com, nome, False
    parecido = difflib.get_close_matches(chave, list(comunidades), n=1, cutoff=0.8)
    if parecido:
        id_com, nome = comunidades[parecido[0]]
        return id_com, nome, True
    return None, None, False


@router.post("/importar", response_model=ImportacaoCursistasResponse, dependencies=[Depends(exigir_admin)])
def importar_cursistas(
    request: Request,
    arquivo: UploadFile = File(...),
    ano: int = Form(...),
    confirmar: bool = Form(False),
):
    """
    Importa a planilha do encontro. confirmar=false → só a prévia.
    Quem já está no ano (mesmo nome) é atualizado: muda a comunidade e completa
    os dados que vierem na planilha (célula vazia não apaga nada). Nunca remove.
    Com qualquer erro, nada é gravado.
    """
    _validar_ano(ano)
    conteudo = arquivo.file.read(TAMANHO_MAXIMO + 1)
    if len(conteudo) > TAMANHO_MAXIMO:
        raise HTTPException(status_code=413, detail="Arquivo grande demais (máximo 5 MB).")
    try:
        lidos = ler_planilha(conteudo)
    except PlanilhaInvalida as e:
        raise HTTPException(status_code=422, detail=str(e))

    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute("SELECT id_comunidade, nome FROM comunidade WHERE tipo = 'cursistas'")
            comunidades = {normalizar(nome): (i, nome) for i, nome in cursor.fetchall()}
            cursor.execute("""
                SELECT id_cursista, nome FROM cursista
                WHERE ano = %s AND status IN ('ativo', 'concluido', 'promovido')
            """, (ano,))
            existentes = {normalizar(nome): i for i, nome in cursor.fetchall()}
            cursor.execute("SELECT nome FROM servo WHERE status IN ('Ativo', 'Inativo')")
            servos = {normalizar(nome) for (nome,) in cursor.fetchall()}

            resultado: list[CursistaImportado] = []
            erros: list[str] = []
            avisos: list[str] = []
            vistos: dict[str, int] = {}
            gravar_linhas = []

            for lido in lidos:
                item = CursistaImportado(linha=lido.linha, nome=lido.nome, acao="novo", avisos=list(lido.avisos))
                chave = normalizar(lido.nome)
                id_com, nome_com, conferir = _achar_comunidade(lido.comunidade, comunidades)
                item.comunidade = nome_com

                if not chave:
                    item.erro = "sem nome"
                elif chave in vistos:
                    item.erro = f"nome repetido na planilha (linha {vistos[chave]})"
                elif not lido.comunidade:
                    item.erro = "sem comunidade"
                elif id_com is None:
                    item.erro = f'comunidade "{lido.comunidade}" não existe'
                vistos.setdefault(chave, lido.linha)

                if item.erro:
                    item.acao = "erro"
                    erros.append(f"Linha {lido.linha} ({lido.nome or 'sem nome'}): {item.erro}.")
                else:
                    if conferir:
                        item.avisos.append(f'comunidade "{lido.comunidade}" entendida como {nome_com}')
                    if chave in servos:
                        item.avisos.append("tem um servo com este nome: confira se é a mesma pessoa")
                    if chave in existentes:
                        item.acao = "atualiza"
                    gravar_linhas.append((lido, id_com, existentes.get(chave)))

                avisos += [f"Linha {lido.linha} ({lido.nome}): {a}." for a in item.avisos]
                resultado.append(item)

            novos = sum(1 for _, _, existente in gravar_linhas if existente is None)
            atualizados = len(gravar_linhas) - novos
            gravar = confirmar and not erros
            if gravar:
                for lido, id_com, existente in gravar_linhas:
                    dados = {
                        "nome": lido.nome, "ano": ano, "id_comunidade": id_com, "telefone": lido.telefone,
                        "email": lido.email, "endereco": lido.endereco, "nascimento": lido.nascimento,
                        "id": existente,
                    }
                    if existente is None:
                        cursor.execute("""
                            INSERT INTO cursista (nome, ano, status, id_comunidade, telefone, email,
                                                  endereco, data_nascimento)
                            VALUES (%(nome)s, %(ano)s, 'ativo', %(id_comunidade)s, %(telefone)s, %(email)s,
                                    %(endereco)s, %(nascimento)s)
                        """, dados)
                    else:
                        cursor.execute("""
                            UPDATE cursista
                            SET id_comunidade = %(id_comunidade)s,
                                telefone = COALESCE(%(telefone)s, telefone),
                                email = COALESCE(%(email)s, email),
                                endereco = COALESCE(%(endereco)s, endereco),
                                data_nascimento = COALESCE(%(nascimento)s, data_nascimento)
                            WHERE id_cursista = %(id)s
                        """, dados)

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao importar cursistas: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")

    if not gravar:
        fora_do_historico(request)
    if gravar:
        message = f"{novos} cursista(s) novo(s) e {atualizados} atualizado(s) em {ano}."
    elif confirmar:
        message = f"Nada foi gravado: corrija o(s) {len(erros)} erro(s) na planilha e envie de novo."
    else:
        message = (f"Prévia de {ano}: {novos} novo(s), {atualizados} já cadastrado(s) (serão atualizados), "
                   f"{len(erros)} erro(s), {len(avisos)} aviso(s).")

    return ImportacaoCursistasResponse(
        ano=ano, message=message, gravado=gravar, novos=novos, atualizados=atualizados,
        cursistas=resultado, erros=erros, avisos=avisos,
    )


@router.get("/faltosos-encontro", response_model=list[FaltosoEncontro], dependencies=[Depends(exigir_admin)])
def listar_faltosos(ano: Optional[int] = None):
    """Cursistas com falta (ou justificada) em algum dia do encontro: são cortados."""
    ano = ano or date.today().year
    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(f"""
                SELECT c.id_cursista, c.nome, co.nome AS comunidade,
                       array_agg(m.data ORDER BY m.data) AS faltas
                FROM cursista c
                JOIN frequencia_cursista f ON f.id_cursista = c.id_cursista
                                          AND f.status IN ('Falta', 'Justificada')
                JOIN missao m ON m.id_missao = f.id_missao
                LEFT JOIN comunidade co ON co.id_comunidade = c.id_comunidade
                WHERE c.ano = %(ano)s AND c.status IN %(status)s
                  AND f.id_missao IN ({SQL_DIAS_ENCONTRO})
                GROUP BY c.id_cursista, c.nome, co.nome
                ORDER BY co.nome, c.nome
            """, {"ano": ano, "status": STATUS_CURSISTA})
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Erro ao listar faltosos do encontro: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")


@router.post("/excluir", response_model=MessageResponse, dependencies=[Depends(exigir_admin)])
def excluir_cursistas(body: ExcluirCursistas):
    """Faltou ao encontro, desistiu ou foi lançado por engano: apaga tudo do cursista."""
    ids = sorted(set(body.ids))
    try:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute("SELECT id_cursista, status FROM cursista WHERE id_cursista = ANY(%s) FOR UPDATE",
                           (ids,))
            achados = dict(cursor.fetchall())
            if len(achados) != len(ids):
                raise HTTPException(status_code=404, detail="Cursista não encontrado. Atualize a lista.")
            if any(status == "promovido" for status in achados.values()):
                raise HTTPException(status_code=400, detail="Quem já virou servo não sai por aqui.")

            cursor.execute("DELETE FROM frequencia_cursista WHERE id_cursista = ANY(%s)", (ids,))
            cursor.execute("DELETE FROM visita_cursista WHERE id_cursista = ANY(%s)", (ids,))  # cascata nos responsáveis
            cursor.execute("DELETE FROM cursista WHERE id_cursista = ANY(%s)", (ids,))

    except HTTPException:
        raise

    except Exception as e:
        logger.error(f"Erro ao excluir cursistas {ids}: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    total = len(ids)
    return MessageResponse(message=f"{total} cursista{'s' if total > 1 else ''} removido{'s' if total > 1 else ''}.")
