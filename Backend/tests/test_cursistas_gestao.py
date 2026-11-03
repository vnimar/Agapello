"""
Gestão dos cursistas (migration 016): importação da planilha do encontro,
corte de quem faltou ao encontro e remoção/desistência. Planilhas fictícias.

Os cursistas criados aqui têm nome começando com "Teste Import" e são apagados no fim.
"""
import io
from datetime import date, datetime

import pytest
from openpyxl import Workbook

from resources.bd.db import get_connection
from resources.importacao.cursistas_xlsx import ler_planilha
from resources.importacao.pastas_xlsx import PlanilhaInvalida

pytestmark = pytest.mark.usefixtures("login_obrigatorio")

ANO = date.today().year
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


def planilha(linhas: list[list], cabecalho=("Nome", "Comunidade"), antes: int = 0) -> bytes:
    wb = Workbook()
    ws = wb.active
    for _ in range(antes):
        ws.append(["Lista de cursistas do encontro"])
    ws.append(list(cabecalho))
    for linha in linhas:
        ws.append(linha)
    saida = io.BytesIO()
    wb.save(saida)
    return saida.getvalue()


def enviar(client, cabecalhos, conteudo, confirmar=False, ano=ANO):
    return client.post("/cursistas/importar", headers=cabecalhos,
                       data={"ano": str(ano), "confirmar": str(confirmar).lower()},
                       files={"arquivo": ("cursistas.xlsx", conteudo, XLSX)})


def cadastrados():
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("""
            SELECT c.nome, co.nome, c.telefone, c.email FROM cursista c
            JOIN comunidade co USING (id_comunidade)
            WHERE c.nome LIKE 'Teste Import%%' AND c.ano = %s
        """, (ANO,))
        return {nome: (com, tel, email) for nome, com, tel, email in cursor.fetchall()}


@pytest.fixture(autouse=True)
def limpar():
    yield
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("""DELETE FROM frequencia_cursista WHERE id_cursista IN
                          (SELECT id_cursista FROM cursista WHERE nome LIKE 'Teste Import%%')""")
        cursor.execute("DELETE FROM cursista WHERE nome LIKE 'Teste Import%%'")


@pytest.fixture
def admin(headers):
    return headers("admin")


# ── Leitura da planilha ───────────────────────────────────────────────────────

def test_le_colunas_em_qualquer_ordem():
    conteudo = planilha(
        [
            ["11/03/1999", 61999990000, "Agnus Dei", "  Teste Import  Ana ", "ANA@Email.com", "Rua 1"],
            [None, None, None, None, None, None],
            [datetime(2001, 5, 2), "(61) 98888-0000", "Kairós", "Teste Import Bia", "sem-arroba", None],
        ],
        cabecalho=("Data de Nascimento", "Telefone", "Comunidade", "Nome completo", "E-mail", "Endereço"),
        antes=2,
    )
    ana, bia = ler_planilha(conteudo)
    assert (ana.linha, ana.nome, ana.comunidade) == (4, "Teste Import Ana", "Agnus Dei")
    assert (ana.telefone, ana.email, ana.endereco, ana.nascimento) == (
        "61999990000", "ana@email.com", "Rua 1", date(1999, 3, 11))
    assert bia.linha == 6 and bia.nascimento == date(2001, 5, 2)
    assert bia.email is None and any("email" in a for a in bia.avisos)


def test_data_invalida_vira_aviso():
    (lido,) = ler_planilha(planilha([["Teste Import Ana", "Kairós", "31/02/2000"]],
                                    cabecalho=("Nome", "Comunidade", "Nascimento")))
    assert lido.nascimento is None and lido.avisos


def test_planilha_sem_cabecalho():
    with pytest.raises(PlanilhaInvalida):
        ler_planilha(planilha([["Teste Import Ana", "Kairós"]], cabecalho=("Pessoa", "Grupo")))


# ── Importação ────────────────────────────────────────────────────────────────

LISTA = [["Teste Import Ana", "Agnus Dei"], ["Teste Import Bia", "comunidade kairos"]]


def test_previa_nao_grava(client, admin):
    resposta = enviar(client, admin, planilha(LISTA))
    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    assert (corpo["novos"], corpo["atualizados"], corpo["gravado"], corpo["erros"]) == (2, 0, False, [])
    assert [c["comunidade"] for c in corpo["cursistas"]] == ["Agnus Dei", "Kairós"]
    assert cadastrados() == {}


def test_confirmar_grava_e_reimportar_completa(client, admin):
    resposta = enviar(client, admin, planilha(LISTA), confirmar=True)
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["gravado"] is True
    assert cadastrados() == {"Teste Import Ana": ("Agnus Dei", None, None),
                             "Teste Import Bia": ("Kairós", None, None)}

    # Ano que vem a planilha vem completa: atualiza sem duplicar e não apaga o que já tinha
    enviar(client, admin, planilha([["Teste Import Ana", "Agnus Dei", "6199"]],
                                   cabecalho=("Nome", "Comunidade", "Telefone")), confirmar=True)
    resposta = enviar(client, admin, planilha([["teste import ANA", "Kenosis", "ana@x.com", ""]],
                                              cabecalho=("Nome", "Comunidade", "Email", "Telefone")),
                      confirmar=True)
    assert resposta.json()["atualizados"] == 1 and resposta.json()["novos"] == 0
    assert cadastrados()["Teste Import Ana"] == ("Kenosis", "6199", "ana@x.com")

    # Entra na chamada da comunidade
    lista = client.get("/cursistas/", headers=admin).json()
    assert {"Teste Import Ana", "Teste Import Bia"} <= {c["nome"] for c in lista}


def test_erro_impede_gravar(client, admin):
    resposta = enviar(client, admin, planilha([
        ["Teste Import Ana", "Agnus Dei"],
        ["Teste Import Ana", "Kairós"],
        ["Teste Import Caio", "Galileia"],
        ["Teste Import Duda", None],
    ]), confirmar=True)
    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    assert corpo["gravado"] is False and len(corpo["erros"]) == 3
    assert [c["acao"] for c in corpo["cursistas"]] == ["novo", "erro", "erro", "erro"]
    assert cadastrados() == {}


def test_avisos_para_conferir(client, admin):
    corpo = enviar(client, admin, planilha([
        ["Teste Import Ana", "Kayros"],      # letra trocada
        ["Teste Servo 1", "Agnus Dei"],      # nome de servo (não é "Teste Import": não grava aqui)
    ])).json()
    assert corpo["erros"] == []
    assert corpo["cursistas"][0]["comunidade"] == "Kairós"
    assert any("Kayros" in a for a in corpo["avisos"])
    assert any("servo com este nome" in a for a in corpo["avisos"])


def test_so_ano_atual_ou_seguinte(client, admin):
    assert enviar(client, admin, planilha(LISTA), ano=ANO - 1).status_code == 422


@pytest.mark.parametrize("login", ["coord.kairos", "tutor.kairos", "formacao"])
def test_gestao_so_admin_e_coord_geral(client, headers, login):
    cabecalhos = headers(login)
    assert enviar(client, cabecalhos, planilha(LISTA)).status_code == 403
    assert client.get("/cursistas/", headers=cabecalhos).status_code == 403
    assert client.get("/cursistas/faltosos-encontro", headers=cabecalhos).status_code == 403
    assert client.post("/cursistas/excluir", headers=cabecalhos, json={"ids": [1]}).status_code == 403


# ── Encontro: corte de quem faltou e remoção ──────────────────────────────────

@pytest.fixture
def no_encontro(client, admin):
    """Ana faltou um dia do encontro, Bia foi aos dois. Devolve {nome: id_cursista}."""
    enviar(client, admin, planilha(LISTA), confirmar=True)
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT nome, id_cursista FROM cursista WHERE nome LIKE 'Teste Import%%'")
        ids = dict(cursor.fetchall())
        cursor.execute("""
            SELECT id_missao FROM missao
            WHERE lower(descricao) ~ '^encontro querigm' AND EXTRACT(YEAR FROM data) = %s
            ORDER BY data LIMIT 2
        """, (ANO,))
        dia1, dia2 = [m for (m,) in cursor.fetchall()]
        for nome, status1, status2 in [("Teste Import Ana", "Presente", "Falta"),
                                       ("Teste Import Bia", "Presente", "Presente")]:
            cursor.executemany(
                "INSERT INTO frequencia_cursista (id_cursista, id_missao, status) VALUES (%s, %s, %s)",
                [(ids[nome], dia1, status1), (ids[nome], dia2, status2)])
    return ids


def test_lista_quem_faltou_ao_encontro(client, admin, no_encontro):
    faltosos = client.get("/cursistas/faltosos-encontro", headers=admin).json()
    nomes = {f["nome"] for f in faltosos}
    assert "Teste Import Ana" in nomes and "Teste Import Bia" not in nomes
    assert len(next(f for f in faltosos if f["nome"] == "Teste Import Ana")["faltas"]) == 1


def test_excluir_apaga_cursista_e_presencas(client, headers, no_encontro):
    ana = no_encontro["Teste Import Ana"]
    resposta = client.post("/cursistas/excluir", headers=headers("coordgeral"), json={"ids": [ana]})
    assert resposta.status_code == 200, resposta.text
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT count(*) FROM cursista WHERE id_cursista = %s", (ana,))
        assert cursor.fetchone()[0] == 0
        cursor.execute("SELECT count(*) FROM frequencia_cursista WHERE id_cursista = %s", (ana,))
        assert cursor.fetchone()[0] == 0
    assert "Teste Import Ana" not in {f["nome"] for f in
                                      client.get("/cursistas/faltosos-encontro", headers=headers("admin")).json()}


def test_excluir_inexistente(client, admin):
    assert client.post("/cursistas/excluir", headers=admin, json={"ids": [999999]}).status_code == 404
