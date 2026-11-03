"""
Missão que não conta na frequência: fica no calendário, mas some da chamada.

Usa uma missão passada do scripts/seed_teste.py que já tem chamada. No fim ela
volta a contar.
"""
import pytest

from resources.bd.db import get_connection

pytestmark = pytest.mark.usefixtures("login_obrigatorio")


@pytest.fixture
def missao(client, headers):
    lista = client.get("/frequencia/missoes", headers=headers("formacao")).json()["data"]
    missao = next(m for m in lista if m["tem_frequencia"])
    yield missao
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("UPDATE missao SET conta_frequencia = true WHERE id_missao = %s", (missao["id_missao"],))


def _ids_da_chamada(client, headers):
    lista = client.get("/frequencia/missoes", headers=headers("formacao")).json()["data"]
    return {m["id_missao"] for m in lista}


def test_nao_conta_sai_da_chamada_e_fica_no_calendario(client, headers, usuarios, missao):
    id_missao = missao["id_missao"]

    resposta = client.put("/missao/conta-frequencia", headers=headers("coordgeral"),
                          json={"ids_nao_conta": [id_missao]})
    assert resposta.status_code == 200, resposta.text
    assert resposta.json() == {"atualizadas": 1}

    assert id_missao not in _ids_da_chamada(client, headers)
    calendario = client.get("/missao/", headers=headers("servo")).json()
    assert any(m["id_missao"] == id_missao and not m["conta_frequencia"] for m in calendario)

    corpo = {"id_servo": usuarios["servo"][1], "id_missao": id_missao, "status": "Presente"}
    recusada = client.put("/frequencia/update", headers=headers("formacao"), json=corpo)
    assert recusada.status_code == 400, recusada.text

    resposta = client.put("/missao/conta-frequencia", headers=headers("admin"),
                          json={"ids_conta": [id_missao]})
    assert resposta.status_code == 200, resposta.text
    assert id_missao in _ids_da_chamada(client, headers)


def test_mesma_missao_nos_dois_lados(client, headers, missao):
    corpo = {"ids_conta": [missao["id_missao"]], "ids_nao_conta": [missao["id_missao"]]}
    resposta = client.put("/missao/conta-frequencia", headers=headers("admin"), json=corpo)
    assert resposta.status_code == 400, resposta.text
