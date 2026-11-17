"""Importação do calendário do ano (.xlsx), no formato do Modelo - Calendário."""
import io
from datetime import date, datetime, time

import pytest
from openpyxl import Workbook

from resources.bd.db import get_connection
from resources.importacao.calendario_xlsx import ler_planilha

ANO = date.today().year + 1
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
MARCA = "[teste-importacao]"  # vai na observação, para limpar só o que o teste gravou
CABECALHO = ("Data", "Missão", "Horário", "Local", "Público", "Conta frequência?", "Observação")


def planilha(linhas: list[tuple], cabecalho=CABECALHO, aba="Calendário") -> bytes:
    wb = Workbook()
    ws = wb.active
    ws.title = aba
    ws.append(cabecalho)
    for linha in linhas:
        ws.append(linha)
    instrucoes = wb.create_sheet("Instruções")
    instrucoes.append(("Modelo — Calendário do Ano",))
    buffer = io.BytesIO()
    wb.save(buffer)
    return buffer.getvalue()


def enviar(client, cabecalhos, conteudo, confirmar=False):
    return client.post("/missao/importar", headers=cabecalhos,
                       data={"confirmar": str(confirmar).lower()},
                       files={"arquivo": ("calendario.xlsx", conteudo, XLSX)})


@pytest.fixture
def admin(headers):
    return headers("admin")


@pytest.fixture(autouse=True)
def limpar_missoes():
    yield
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("DELETE FROM missao WHERE observacao LIKE %s", (f"%{MARCA}%",))


def gravadas() -> list[tuple]:
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("""SELECT data, descricao, horario, local, publico, conta_frequencia FROM missao
                          WHERE observacao LIKE %s ORDER BY data, descricao""", (f"%{MARCA}%",))
        return cursor.fetchall()


# ── Leitura da planilha ───────────────────────────────────────────────────────

def test_le_as_colunas_do_modelo():
    lidas = ler_planilha(planilha([
        (datetime(ANO, 3, 14), "Missa Mensal do Ágape", time(19, 30), "Capela NSS das Graças", "Servos", "Sim", None),
        (f"15/03/{ANO}", "Noite de Louvor", "19h30", "A Definir", "Ambos", "Não", "Trazer violão"),
        (f"16/03/{str(ANO)[2:]}", "Formação de Cursistas", "17", None, "cursistas", None, None),
        (None, None, None, None, None, None, None),  # linha vazia: pulada
    ]))
    missa, louvor, formacao = lidas

    assert missa.data == date(ANO, 3, 14) and missa.horario == time(19, 30)
    assert missa.local == "Capela NSS das Graças" and missa.publico == "servos" and missa.conta_frequencia
    assert louvor.data == date(ANO, 3, 15) and louvor.horario == time(19, 30)
    assert louvor.local is None  # "A Definir" vira sem local
    assert louvor.publico == "ambos" and not louvor.conta_frequencia
    assert louvor.observacao == "Trazer violão"
    assert formacao.data == date(ANO, 3, 16)  # ano com 2 dígitos é 20xx
    assert formacao.horario == time(17, 0) and formacao.publico == "cursistas" and formacao.conta_frequencia
    assert formacao.linha == 4


def test_colunas_em_outra_ordem_e_avisos():
    lidas = ler_planilha(planilha(
        [("Retiro de Servos", f"01/04/{ANO}", "de tarde", "Jovens")],
        cabecalho=("Missão", "Data", "Horário", "Público"),
    ))
    retiro = lidas[0]
    assert retiro.descricao == "Retiro de Servos" and retiro.data == date(ANO, 4, 1)
    assert retiro.horario is None and retiro.publico == "servos"
    assert len(retiro.avisos) == 2 and not retiro.erro


def test_erros_por_linha():
    sem_data, data_ruim, sem_nome = ler_planilha(planilha([
        (None, "Missa", None, None, None, None, None),
        ("31/02/2027", "Missa", None, None, None, None, None),
        (f"01/05/{ANO}", None, None, None, None, None, None),
    ]))
    assert sem_data.erro == "sem data"
    assert "inválida" in data_ruim.erro
    assert sem_nome.erro == "sem o nome da missão"


# ── Rota ──────────────────────────────────────────────────────────────────────

def test_arquivo_que_nao_e_planilha(client, admin):
    assert enviar(client, admin, b"isto nao e um xlsx").status_code == 422


def test_planilha_sem_cabecalho(client, admin):
    resposta = enviar(client, admin, planilha([("x", "y")], cabecalho=("Nome", "Comunidade")))
    assert resposta.status_code == 422
    assert "Data" in resposta.json()["detail"]


def test_so_quem_administra_o_calendario(client, headers):
    resposta = enviar(client, headers("servo"), planilha([(f"01/06/{ANO}", "Missa", None, None, None, None, MARCA)]))
    assert resposta.status_code == 403


def test_previa_nao_grava_e_confirmar_grava(client, admin):
    conteudo = planilha([
        (f"10/02/{ANO}", "Missa Mensal do Ágape", "19:30", "Capela", "Servos", "Sim", MARCA),
        (f"11/02/{ANO}", "Noite de Louvor", None, None, "Servos", "Não", MARCA),
    ])
    previa = enviar(client, admin, conteudo)
    assert previa.status_code == 200, previa.text
    corpo = previa.json()
    assert corpo["novas"] == 2 and corpo["gravadas"] == 0 and not corpo["erros"]
    assert [i["situacao"] for i in corpo["itens"]] == ["nova", "nova"]
    assert gravadas() == []

    final = enviar(client, admin, conteudo, confirmar=True).json()
    assert final["gravadas"] == 2
    assert gravadas() == [
        (date(ANO, 2, 10), "Missa Mensal do Ágape", time(19, 30), "Capela", "servos", True),
        (date(ANO, 2, 11), "Noite de Louvor", None, None, "servos", False),
    ]

    # De novo: tudo já está no calendário (mesmo com outra grafia) e nada se repete
    de_novo = enviar(client, admin, planilha([
        (f"10/02/{ANO}", "missa mensal do agape", None, None, None, None, MARCA),
    ]), confirmar=True).json()
    assert de_novo["duplicadas"] == 1 and de_novo["gravadas"] == 0
    assert len(gravadas()) == 2


def test_repetida_na_propria_planilha(client, admin):
    corpo = enviar(client, admin, planilha([
        (f"12/02/{ANO}", "Retiro de Servos", None, None, None, None, MARCA),
        (f"12/02/{ANO}", "Retiro de Servos", None, None, None, None, MARCA),
    ]), confirmar=True).json()
    assert [i["situacao"] for i in corpo["itens"]] == ["nova", "duplicada"]
    assert corpo["gravadas"] == 1


def test_com_erro_nada_e_gravado(client, admin):
    corpo = enviar(client, admin, planilha([
        (f"13/02/{ANO}", "Retiro de Servos", None, None, None, None, MARCA),
        (f"13/02/{ANO + 10}", "Retiro de Servos", None, None, None, None, MARCA),
    ]), confirmar=True).json()
    assert corpo["gravadas"] == 0 and len(corpo["erros"]) == 1
    assert "fora do esperado" in corpo["erros"][0]
    assert gravadas() == []


def test_avisa_nome_parecido_com_missao_existente(client, admin):
    # Primeiro grava um nome; depois manda uma grafia diferente o bastante para não ser igual
    enviar(client, admin, planilha([(f"14/02/{ANO}", "Formação de Cursistas", None, None, None, None, MARCA)]),
           confirmar=True)
    corpo = enviar(client, admin, planilha([
        (f"15/02/{ANO}", "Formação de Cursista", None, None, None, None, MARCA),
        (f"16/02/{ANO}", "Missão totalmente nova xyz", None, None, None, None, MARCA),
    ])).json()
    parecida, nova = corpo["itens"]
    assert parecida["nome_novo"] and any("Formação de Cursistas" in a for a in parecida["avisos"])
    assert nova["nome_novo"] and nova["avisos"] == []
