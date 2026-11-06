"""
Quadrante: dados de todos os servos ativos e dos cursistas do ano, para qualquer
servo logado (sem frequência). Edição dos dados do cursista: admin e coord. geral.

Os cursistas criados aqui têm nome começando com "Teste Quadrante" e são apagados no fim.
"""
from datetime import date

import pytest

from resources.bd.db import get_connection

pytestmark = pytest.mark.usefixtures("login_obrigatorio")

ANO = date.today().year


@pytest.fixture
def id_cursista():
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("""
            INSERT INTO cursista (nome, apelido, ano, status, id_comunidade, telefone, responsavel_nome)
            SELECT 'Teste Quadrante Ana', 'Aninha', %s, 'ativo', id_comunidade, '6199', 'Mãe Teste'
            FROM comunidade WHERE nome = 'Kyrios'
            RETURNING id_cursista
        """, (ANO,))
        id_cursista = cursor.fetchone()[0]
    yield id_cursista
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("DELETE FROM cursista WHERE nome LIKE 'Teste Quadrante%%'")


def test_qualquer_servo_ve(client, headers, usuarios, id_cursista):
    resposta = client.get("/quadrante/", headers=headers("servo"))
    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    assert corpo["ano"] == ANO

    eu = next(s for s in corpo["servos"] if s["id"] == usuarios["servo"][1])
    assert {"telefone", "endereco", "responsavel_nome", "pastas", "ano_ingresso"} <= set(eu)
    assert "percentual_presenca" not in eu  # frequência não entra no quadrante
    assert all(p["momento"] in ("encontro", "pos") for s in corpo["servos"] for p in s["pastas"])

    ana = next(c for c in corpo["cursistas"] if c["id_cursista"] == id_cursista)
    assert (ana["apelido"], ana["comunidade"], ana["responsavel_nome"]) == ("Aninha", "Kyrios", "Mãe Teste")


def test_inativo_nao_aparece(client, headers):
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT id_servo FROM servo WHERE status <> 'Ativo'")
        fora = {i for (i,) in cursor.fetchall()}
    ids = {s["id"] for s in client.get("/quadrante/", headers=headers("servo")).json()["servos"]}
    assert ids and not ids & fora


def test_sem_login_nao_ve(client, headers):
    assert client.get("/quadrante/", headers=headers(None)).status_code == 401


def test_admin_edita_dados_do_cursista(client, headers, id_cursista):
    for login in ("admin", "coordgeral"):
        resposta = client.put(f"/cursistas/{id_cursista}/dados", headers=headers(login),
                              json={"apelido": " Ana ", "responsavel_telefone": "6198"})
        assert resposta.status_code == 200, (login, resposta.text)
    dados = resposta.json()
    # O que não veio fica como estava
    assert (dados["apelido"], dados["responsavel_telefone"], dados["telefone"]) == ("Ana", "6198", "6199")


def test_outros_nao_editam_cursista(client, headers, id_cursista):
    for login in ("servo", "coord.kairos", "formacao"):
        resposta = client.put(f"/cursistas/{id_cursista}/dados", headers=headers(login), json={"apelido": "X"})
        assert resposta.status_code == 403, (login, resposta.text)


def test_editar_cursista_inexistente(client, headers):
    resposta = client.put("/cursistas/999999999/dados", headers=headers("admin"), json={"apelido": "X"})
    assert resposta.status_code == 404
