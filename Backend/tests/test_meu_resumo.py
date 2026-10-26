"""
Minha conta: GET /auth/me/resumo (frequência do ano, foguinho e pastas).

Usa os dados do scripts/seed_teste.py: 4 missões passadas de servos com
frequência, status em rodízio Presente/Presente/Falta/Justificada.
"""
import pytest

pytestmark = pytest.mark.usefixtures("login_obrigatorio")


def resumo(client, headers, login):
    resposta = client.get("/auth/me/resumo", headers=headers(login))
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


def test_sem_login_nao_ve(client, headers):
    assert client.get("/auth/me/resumo", headers=headers(None)).status_code == 401


def test_frequencia_do_ano_bate_com_as_missoes(client, headers):
    dados = resumo(client, headers, "servo")
    freq = dados["frequencia"]
    status = [m["status"] for m in dados["missoes"]]

    assert len(status) == 4
    assert freq["presente"] == status.count("Presente")
    assert freq["justificada"] == status.count("Justificada")
    assert freq["falta"] == status.count("Falta")
    assert freq["percentual_presenca"] == round(
        (freq["presente"] + freq["justificada"]) * 100 / len(status), 2
    )
    assert all(m["data"].startswith(str(dados["ano"])) for m in dados["missoes"])


def test_missoes_da_mais_recente_para_a_mais_antiga(client, headers):
    datas = [m["data"] for m in resumo(client, headers, "servo")["missoes"]]
    assert datas == sorted(datas, reverse=True)


def test_nao_mostra_missao_futura(client, headers):
    dados = resumo(client, headers, "servo")
    assert all("próxima" not in m["descricao"] for m in dados["missoes"])


def test_foguinho_vem_da_view(client, headers):
    fogo = resumo(client, headers, "servo")["foguinho"]
    assert fogo["recorde"] >= fogo["sequencia_atual"] >= 0
    assert fogo["chama_acesa"] == (fogo["sequencia_atual"] > 0)


def test_pastas_do_ano(client, headers):
    pastas = resumo(client, headers, "servo")["pastas"]
    assert [p["nome"] for p in pastas] == ["Música"]


def test_pasta_do_ano_que_vem_nao_aparece(client, headers):
    # Tem Música no ano atual e Coordenador Geral no ano que vem
    pastas = resumo(client, headers, "proximo.ano")["pastas"]
    assert [p["nome"] for p in pastas] == ["Música"]


def test_conta_sem_servo_vem_vazia(client, headers):
    dados = resumo(client, headers, "geral.manual")
    assert dados["id_servo"] is None
    assert dados["missoes"] == [] and dados["pastas"] == []
    assert dados["frequencia"]["percentual_presenca"] is None


def test_coordenacao_ve_a_mesma_frequencia_anual(client, headers, usuarios):
    # A aba Servo dos coordenadores e a Minha conta seguem a mesma regra anual
    meu = resumo(client, headers, "servo")
    resposta = client.get("/frequencia/servos", headers=headers("formacao"))
    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    linha = next(s for s in corpo["data"] if s["id_servo"] == usuarios["servo"][1])

    assert corpo["ano"] == meu["ano"]
    for campo in ("presente", "justificada", "falta", "percentual_presenca"):
        assert linha[campo] == meu["frequencia"][campo]
