"""
Revisão anual de inativos (migration 015): quem está inativo há mais de 2 anos
pode ser excluído (fica 'Excluido', sem dados pessoais nem acesso, mas com o
nome e o histórico) e só volta antes disso como exceção confirmada.

Cria os próprios servos de teste e apaga tudo no fim.
"""
import pytest

from resources.bd.db import get_connection

pytestmark = pytest.mark.usefixtures("login_obrigatorio")


def _novo_inativo(cursor, nome, anos_fora):
    cursor.execute("""
        INSERT INTO servo (nome, status, ano_ingresso, telefone, email, endereco, data_nascimento)
        VALUES (%s, 'Inativo', 2020, '11 90000-0000', 'contato@teste.agapello', 'Rua Teste, 1', DATE '1990-01-01')
        RETURNING id_servo
    """, (nome,))
    id_servo = cursor.fetchone()[0]
    cursor.execute("""
        INSERT INTO servo_afastamento (id_servo, data_saida, motivo)
        VALUES (%s, CURRENT_DATE - make_interval(years => %s) - INTERVAL '1 day', 'Motivo pessoal')
    """, (id_servo, anos_fora))
    return id_servo


@pytest.fixture
def inativos():
    """{"antigo": inativo há 3 anos e com login, "recente": inativo há 1 ano}"""
    with get_connection() as conn, conn.cursor() as cursor:
        antigo = _novo_inativo(cursor, "Teste Revisão Antigo", 3)
        recente = _novo_inativo(cursor, "Teste Revisão Recente", 1)
        cursor.execute("""
            INSERT INTO usuario (nome, email, perfil, senha_hash, ativo, id_servo)
            VALUES ('Teste Revisão Antigo', 'revisao.antigo@teste.agapello', 'coordenador_geral', 'x', false, %s)
        """, (antigo,))
    ids = {"antigo": antigo, "recente": recente}
    yield ids
    with get_connection() as conn, conn.cursor() as cursor:
        todos = list(ids.values())
        cursor.execute("DELETE FROM usuario WHERE id_servo = ANY(%s)", (todos,))
        cursor.execute("DELETE FROM servo_afastamento WHERE id_servo = ANY(%s)", (todos,))
        cursor.execute("DELETE FROM servo WHERE id_servo = ANY(%s)", (todos,))


def test_lista_so_quem_saiu_ha_mais_de_2_anos(client, headers, inativos):
    resposta = client.get("/servos/revisao-inativos", headers=headers("coordgeral"))
    assert resposta.status_code == 200, resposta.text
    por_id = {i["id"]: i for i in resposta.json()}
    assert inativos["antigo"] in por_id
    assert por_id[inativos["antigo"]]["tem_login"] is True
    assert inativos["recente"] not in por_id


@pytest.mark.parametrize("login", ["formacao", "servo"])
def test_revisao_so_admin_e_coord_geral(client, headers, inativos, login):
    assert client.get("/servos/revisao-inativos", headers=headers(login)).status_code == 403
    assert client.post("/servos/excluir", headers=headers(login),
                       json={"ids": [inativos["antigo"]]}).status_code == 403


def test_nao_exclui_quem_ainda_esta_no_prazo(client, headers, inativos):
    resposta = client.post("/servos/excluir", headers=headers("admin"),
                           json={"ids": [inativos["antigo"], inativos["recente"]]})
    assert resposta.status_code == 400, resposta.text
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT status FROM servo WHERE id_servo = %s", (inativos["antigo"],))
        assert cursor.fetchone()[0] == "Inativo"  # nada foi gravado


def test_excluir_apaga_dados_pessoais_e_mantem_nome(client, headers, inativos):
    antigo = inativos["antigo"]
    resposta = client.post("/servos/excluir", headers=headers("coordgeral"), json={"ids": [antigo]})
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["excluidos"] == 1

    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("""
            SELECT nome, status, excluido_em IS NOT NULL, telefone, email, endereco, data_nascimento
            FROM servo WHERE id_servo = %s
        """, (antigo,))
        assert cursor.fetchone() == ("Teste Revisão Antigo", "Excluido", True, None, None, None, None)
        cursor.execute("SELECT motivo FROM servo_afastamento WHERE id_servo = %s", (antigo,))
        assert cursor.fetchone() == (None,)
        cursor.execute("SELECT email, ativo, senha_hash, perfil FROM usuario WHERE id_servo = %s", (antigo,))
        email, ativo, senha_hash, perfil = cursor.fetchone()
        assert email.endswith("@agapello.invalid") and not ativo and senha_hash is None and perfil == "servo"

    # Some da revisão e da lista de usuários; continua na de servos como 'Excluido'
    revisao = client.get("/servos/revisao-inativos", headers=headers("admin")).json()
    assert antigo not in {i["id"] for i in revisao}
    usuarios = client.get("/usuarios/", headers=headers("admin")).json()
    assert antigo not in {u["id_servo"] for u in usuarios}
    servos = client.get("/servos/", headers=headers("admin")).json()
    assert next(s for s in servos if s["id"] == antigo)["status"] == "Excluido"

    # Excluído não volta
    resposta = client.put(f"/servos/{antigo}/status", headers=headers("admin"),
                          json={"status": "Ativo", "excecao": True})
    assert resposta.status_code == 400, resposta.text


def test_reativar_depois_do_prazo_so_como_excecao(client, headers, inativos):
    rota = f"/servos/{inativos['antigo']}/status"
    resposta = client.put(rota, headers=headers("admin"), json={"status": "Ativo"})
    assert resposta.status_code == 409, resposta.text

    resposta = client.put(rota, headers=headers("admin"), json={"status": "Ativo", "excecao": True})
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["status"] == "Ativo"


def test_reativar_dentro_do_prazo_sem_excecao(client, headers, inativos):
    resposta = client.put(f"/servos/{inativos['recente']}/status", headers=headers("admin"),
                          json={"status": "Ativo"})
    assert resposta.status_code == 200, resposta.text


def test_lista_de_servos_traz_data_de_saida(client, headers, inativos):
    servos = client.get("/servos/", headers=headers("admin")).json()
    recente = next(s for s in servos if s["id"] == inativos["recente"])
    assert recente["data_saida"] is not None
