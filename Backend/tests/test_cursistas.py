"""
Chamada de cursistas: só Formação de Cursistas e Encontro Querigmático (pelo
nome), só até hoje e só os cursistas das comunidades de quem faz a chamada.

Usa os dados do scripts/seed_teste.py: Kairós, Maranata e Kenosis com 3
cursistas cada; chamada lançada nos dois dias do encontro e na 1ª formação;
a 2ª formação (há 2 dias) ainda sem chamada.
"""
from datetime import date

import pytest
from resources.bd.db import get_connection

pytestmark = pytest.mark.usefixtures("login_obrigatorio")


def missoes(client, headers, login="coord.kairos"):
    resposta = client.get("/cursistas/chamada/missoes", headers=headers(login))
    assert resposta.status_code == 200, resposta.text
    return resposta.json()["data"]


def chamada(client, headers, id_missao, login="coord.kairos"):
    resposta = client.get(f"/cursistas/chamada/{id_missao}", headers=headers(login))
    assert resposta.status_code == 200, resposta.text
    return resposta.json()


def missao_do_calendario(client, headers, filtro):
    return next(m for m in client.get("/missao/", headers=headers("admin")).json() if filtro(m))


# ── Missões ──────────────────────────────────────────────────────────────────

def test_so_formacao_e_encontro_ate_hoje(client, headers):
    lista = missoes(client, headers)
    hoje = date.today().isoformat()
    assert {m["descricao"] for m in lista} == {"Formação de Cursistas", "Encontro Querigmático"}
    assert len(lista) == 4
    assert all(m["data"] <= hoje for m in lista)
    assert [m["data"] for m in lista] == sorted((m["data"] for m in lista), reverse=True)


def test_marca_as_que_ja_tem_chamada(client, headers):
    lista = missoes(client, headers)
    assert [m["tem_frequencia"] for m in lista] == [False, True, True, True]


# ── Comunidades ──────────────────────────────────────────────────────────────

def test_coordenador_ve_so_a_propria_comunidade(client, headers):
    id_missao = missoes(client, headers)[1]["id_missao"]
    comunidades = chamada(client, headers, id_missao)["comunidades"]
    assert [c["nome"] for c in comunidades] == ["Kairós"]
    assert len(comunidades[0]["cursistas"]) == 3
    assert all(c["status"] for c in comunidades[0]["cursistas"])


def test_tutor_ve_so_a_propria_comunidade(client, headers):
    id_missao = missoes(client, headers, "tutor.maranata")[1]["id_missao"]
    comunidades = chamada(client, headers, id_missao, "tutor.maranata")["comunidades"]
    assert [c["nome"] for c in comunidades] == ["Maranata"]


@pytest.mark.parametrize("login", ["admin", "coordgeral"])
def test_coordenacao_geral_ve_todas(client, headers, login):
    id_missao = missoes(client, headers, login)[1]["id_missao"]
    comunidades = chamada(client, headers, id_missao, login)["comunidades"]
    assert len(comunidades) == 5
    # Só Kairós, Maranata e Kenosis têm cursistas no teste
    assert sorted(c["nome"] for c in comunidades if c["cursistas"]) == ["Kairós", "Kenosis", "Maranata"]


def test_chamada_nao_feita_vem_sem_status(client, headers):
    id_missao = missoes(client, headers)[0]["id_missao"]
    cursistas = chamada(client, headers, id_missao)["comunidades"][0]["cursistas"]
    assert cursistas and all(c["status"] is None for c in cursistas)


def test_cursista_ainda_no_processo_nao_aparece(client, headers):
    id_missao = missoes(client, headers, "admin")[1]["id_missao"]
    nomes = [c["nome"] for com in chamada(client, headers, id_missao, "admin")["comunidades"]
             for c in com["cursistas"]]
    assert all(nome.startswith("Teste Cursista") for nome in nomes)


# ── Missões que não recebem chamada ──────────────────────────────────────────

@pytest.mark.parametrize("metodo", ["GET", "PUT"])
def test_formacao_futura_recusa(client, headers, metodo):
    futura = missao_do_calendario(client, headers, lambda m: m["descricao"].startswith("Formação de Cursistas")
                                  and m["data"] > date.today().isoformat())
    resposta = client.request(metodo, f"/cursistas/chamada/{futura['id_missao']}", headers=headers("coord.kairos"),
                              json={"itens": [{"id_cursista": 1, "status": "Presente"}]})
    assert resposta.status_code == 400, resposta.text


def test_missao_que_nao_e_de_cursista_nao_existe_aqui(client, headers):
    missa = missao_do_calendario(client, headers, lambda m: m["publico"] == "ambos")
    resposta = client.get(f"/cursistas/chamada/{missa['id_missao']}", headers=headers("coord.kairos"))
    assert resposta.status_code == 404


# ── Salvar ───────────────────────────────────────────────────────────────────

@pytest.fixture
def formacao_sem_chamada(client, headers):
    """A 2ª formação, sem chamada; o que o teste gravar é apagado no fim."""
    id_missao = missoes(client, headers)[0]["id_missao"]
    yield id_missao
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("DELETE FROM frequencia_cursista WHERE id_missao = %s", (id_missao,))


def test_salva_e_corrige_a_chamada(client, headers, formacao_sem_chamada):
    id_missao = formacao_sem_chamada
    cursistas = chamada(client, headers, id_missao)["comunidades"][0]["cursistas"]
    itens = [{"id_cursista": c["id_cursista"], "status": "Presente"} for c in cursistas]

    resposta = client.put(f"/cursistas/chamada/{id_missao}", headers=headers("tutor.kairos"), json={"itens": itens})
    assert resposta.status_code == 200, resposta.text

    itens[0]["status"] = "Falta"
    resposta = client.put(f"/cursistas/chamada/{id_missao}", headers=headers("coord.kairos"), json={"itens": itens})
    assert resposta.status_code == 200, resposta.text

    status = [c["status"] for c in chamada(client, headers, id_missao)["comunidades"][0]["cursistas"]]
    assert status == ["Falta", "Presente", "Presente"]
    assert missoes(client, headers)[0]["tem_frequencia"] is True


def test_nao_salva_cursista_de_outra_comunidade(client, headers, formacao_sem_chamada):
    id_missao = formacao_sem_chamada
    maranata = chamada(client, headers, id_missao, "tutor.maranata")["comunidades"][0]["cursistas"]
    resposta = client.put(f"/cursistas/chamada/{id_missao}", headers=headers("coord.kairos"),
                          json={"itens": [{"id_cursista": maranata[0]["id_cursista"], "status": "Presente"}]})
    assert resposta.status_code == 403
    assert all(c["status"] is None for c in chamada(client, headers, id_missao, "tutor.maranata")
               ["comunidades"][0]["cursistas"])
