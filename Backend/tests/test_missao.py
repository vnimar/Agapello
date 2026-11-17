"""Cadastro de missões pelo calendário: criar, editar, excluir e o que conta na frequência."""
from datetime import date

import pytest

from resources.bd.db import get_connection

DATA = date(date.today().year + 1, 6, 20).isoformat()
MARCA = "[teste-missao]"


@pytest.fixture
def admin(headers):
    return headers("admin")


@pytest.fixture(autouse=True)
def limpar():
    yield
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("DELETE FROM missao WHERE observacao LIKE %s", (f"%{MARCA}%",))


def criar(client, admin, **campos):
    corpo = {"data": DATA, "descricao": "Missão de teste", "observacao": MARCA, **campos}
    resposta = client.post("/missao/", headers=admin, json=corpo)
    assert resposta.status_code == 201, resposta.text
    return resposta.json()


def test_criar_aparece_no_calendario_com_padroes(client, admin, headers):
    missao = criar(client, admin, descricao="  Retiro de teste  ")
    assert missao["descricao"] == "Retiro de teste"  # sem espaços nas pontas
    assert missao["horario"] == "Horário não definido" and missao["local"] == "Local não definido"
    assert missao["publico"] == "servos" and missao["conta_frequencia"] is True

    # Qualquer pessoa logada vê o calendário
    calendario = client.get("/missao/", headers=headers("servo")).json()
    assert any(m["id_missao"] == missao["id_missao"] for m in calendario)


def test_descricao_vazia_recusa(client, admin):
    resposta = client.post("/missao/", headers=admin, json={"data": DATA, "descricao": "   "})
    assert resposta.status_code == 422


def test_editar(client, admin):
    missao = criar(client, admin)
    resposta = client.put(f"/missao/{missao['id_missao']}", headers=admin, json={
        "data": DATA, "descricao": "Missão editada", "horario": "17:00", "local": "Paróquia",
        "publico": "ambos", "conta_frequencia": False, "observacao": MARCA,
    })
    assert resposta.status_code == 200, resposta.text
    editada = resposta.json()
    assert editada["descricao"] == "Missão editada" and editada["horario"] == "17:00"
    assert editada["local"] == "Paróquia" and editada["publico"] == "ambos"
    assert editada["conta_frequencia"] is False


def test_editar_inexistente(client, admin):
    resposta = client.put("/missao/999999", headers=admin, json={"data": DATA, "descricao": "x"})
    assert resposta.status_code == 404


def test_excluir_sem_chamada(client, admin):
    missao = criar(client, admin)
    assert client.delete(f"/missao/{missao['id_missao']}", headers=admin).status_code == 204
    assert client.delete(f"/missao/{missao['id_missao']}", headers=admin).status_code == 404


def test_nao_exclui_missao_com_chamada(client, admin, usuarios):
    missao = criar(client, admin)
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("INSERT INTO frequencia (id_servo, id_missao, status, data) "
                       "VALUES (%s, %s, 'Presente', CURRENT_DATE)",
                       (usuarios["servo"][1], missao["id_missao"]))
    try:
        resposta = client.delete(f"/missao/{missao['id_missao']}", headers=admin)
        assert resposta.status_code == 409
    finally:
        with get_connection() as conn, conn.cursor() as cursor:
            cursor.execute("DELETE FROM frequencia WHERE id_missao = %s", (missao["id_missao"],))


def test_conta_frequencia_em_lote(client, admin):
    a = criar(client, admin, descricao="Missão A")
    b = criar(client, admin, descricao="Missão B", conta_frequencia=False)
    resposta = client.put("/missao/conta-frequencia", headers=admin,
                          json={"ids_conta": [b["id_missao"]], "ids_nao_conta": [a["id_missao"]]})
    assert resposta.status_code == 200, resposta.text
    calendario = {m["id_missao"]: m for m in client.get("/missao/", headers=admin).json()}
    assert calendario[a["id_missao"]]["conta_frequencia"] is False
    assert calendario[b["id_missao"]]["conta_frequencia"] is True


def test_conta_e_nao_conta_ao_mesmo_tempo_recusa(client, admin):
    a = criar(client, admin)
    resposta = client.put("/missao/conta-frequencia", headers=admin,
                          json={"ids_conta": [a["id_missao"]], "ids_nao_conta": [a["id_missao"]]})
    assert resposta.status_code == 400
