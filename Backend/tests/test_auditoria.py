"""
Histórico de auditoria no banco (migration 017): toda alteração que deu certo
vira uma linha em auditoria, com os dados pessoais mascarados. Só o
administrador consulta. As linhas criadas aqui são apagadas no fim.
"""
import pytest

from resources.bd.db import get_connection
from tests.conftest import SENHA_TESTE, DOMINIO

pytestmark = pytest.mark.usefixtures("login_obrigatorio")


@pytest.fixture
def ultimo_id():
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT COALESCE(max(id_auditoria), 0) FROM auditoria")
        inicio = cursor.fetchone()[0]
    yield inicio
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("DELETE FROM auditoria WHERE id_auditoria > %s", (inicio,))


@pytest.fixture
def servo(usuarios):
    id_servo = usuarios["servo"][1]
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT telefone FROM servo WHERE id_servo = %s", (id_servo,))
        telefone = cursor.fetchone()[0]
    yield id_servo
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("UPDATE servo SET telefone = %s, email = NULL, endereco = NULL, data_nascimento = NULL"
                       " WHERE id_servo = %s", (telefone, id_servo))


def _novos(desde):
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT usuario, metodo, rota, status, corpo FROM auditoria"
                       " WHERE id_auditoria > %s ORDER BY id_auditoria", (desde,))
        return cursor.fetchall()


def test_alteracao_vai_para_o_historico_mascarada(client, headers, ultimo_id, servo):
    resposta = client.put(f"/servos/{servo}/dados", headers=headers("servo"),
                          json={"telefone": "61 91234-5678", "email": "a@b.co"})
    assert resposta.status_code == 200, resposta.text

    (usuario, metodo, rota, status, corpo), = _novos(ultimo_id)
    assert (metodo, rota, status) == ("PUT", f"/servos/{servo}/dados", 200)
    assert "servo" in usuario
    assert "91234" not in corpo and '"telefone":"***"' in corpo


def test_recusado_e_login_nao_entram(client, headers, ultimo_id, servo):
    client.put(f"/servos/{servo}/dados", headers=headers("formacao"), json={})  # 403
    client.post("/auth/login", headers=headers(None), json={"email": "servo" + DOMINIO, "senha": SENHA_TESTE})
    assert _novos(ultimo_id) == []


def test_so_admin_consulta(client, headers, ultimo_id, servo):
    client.put(f"/servos/{servo}/dados", headers=headers("servo"), json={"telefone": "1"})

    resposta = client.get("/auditoria/", headers=headers("admin"), params={"busca": f"/servos/{servo}/dados"})
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()[0]["rota"] == f"/servos/{servo}/dados"

    assert client.get("/auditoria/", headers=headers("coordgeral")).status_code == 403


def test_previa_de_importacao_nao_entra(client, headers, ultimo_id):
    from tests.test_cursistas_gestao import planilha, enviar
    resposta = enviar(client, headers("admin"), planilha([["Teste Import Auditoria", "Kairós"]]))
    assert resposta.status_code == 200, resposta.text
    assert _novos(ultimo_id) == []
