"""
Frequência dos servos: só pode ser lançada a partir do dia da missão.

Usa os dados do scripts/seed_teste.py (missões passadas com frequência e
uma "próxima missão de servos" no futuro). Nada é gravado.
"""
from datetime import date

import pytest

pytestmark = pytest.mark.usefixtures("login_obrigatorio")


@pytest.fixture
def missoes(client, headers):
    hoje = date.today().isoformat()
    calendario = client.get("/missao/", headers=headers("formacao")).json()
    futura = next(m for m in calendario if m["data"] > hoje)
    resposta = client.get("/frequencia/missoes", headers=headers("formacao"))
    assert resposta.status_code == 200, resposta.text
    passada = next(m for m in resposta.json()["data"] if m["tem_frequencia"])
    return futura, passada


def test_lista_da_chamada_nao_tem_missao_futura(client, headers):
    lista = client.get("/frequencia/missoes", headers=headers("formacao")).json()["data"]
    datas = [m["data"] for m in lista]
    assert datas and max(datas) <= date.today().isoformat()
    assert datas == sorted(datas, reverse=True)


@pytest.mark.parametrize("metodo, rota", [("POST", "/frequencia/register"), ("PUT", "/frequencia/update")])
def test_missao_futura_recusa(client, headers, usuarios, missoes, metodo, rota):
    futura, _ = missoes
    corpo = {"id_servo": usuarios["servo"][1], "id_missao": futura["id_missao"], "status": "Presente"}
    resposta = client.request(metodo, rota, headers=headers("formacao"), json=corpo)
    assert resposta.status_code == 400, resposta.text
    assert "ainda não aconteceu" in resposta.json()["detail"]


def test_missao_passada_passa_da_checagem(client, headers, usuarios, missoes):
    # 409 = passou da checagem de data e parou na duplicidade (nada gravado)
    _, passada = missoes
    corpo = {"id_servo": usuarios["servo"][1], "id_missao": passada["id_missao"], "status": "Presente"}
    resposta = client.post("/frequencia/register", headers=headers("formacao"), json=corpo)
    assert resposta.status_code == 409, resposta.text


def test_missoes_do_servo_bate_com_o_resumo(client, headers, usuarios):
    id_servo = usuarios["servo"][1]
    resposta = client.get(f"/frequencia/servo/{id_servo}/missoes", headers=headers("formacao"))
    assert resposta.status_code == 200, resposta.text
    missoes = resposta.json()["data"]
    resumo = next(r for r in client.get("/frequencia/servos", headers=headers("formacao")).json()["data"]
                  if r["id_servo"] == id_servo)
    assert sum(m["status"] == "Falta" for m in missoes) == resumo["falta"]
    assert sum(m["status"] == "Justificada" for m in missoes) == resumo["justificada"]


@pytest.mark.parametrize("login, esperado", [("servo", 403), ("coordgeral", 200), ("admin", 200)])
def test_missoes_do_servo_so_para_a_coordenacao(client, headers, usuarios, login, esperado):
    id_servo = usuarios["formacao"][1]
    resposta = client.get(f"/frequencia/servo/{id_servo}/missoes", headers=headers(login))
    assert resposta.status_code == esperado, resposta.text
