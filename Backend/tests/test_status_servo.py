"""
Inativar e reativar servo: a saída fica em servo_afastamento e é fechada no retorno.

Usa o servo do usuário "servo" do scripts/seed_teste.py. No fim o servo volta
a Ativo e os afastamentos criados aqui são apagados.
"""
import pytest

from resources.bd.db import get_connection

pytestmark = pytest.mark.usefixtures("login_obrigatorio")


@pytest.fixture
def id_servo(usuarios):
    id_servo = usuarios["servo"][1]
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT max(id_afastamento) FROM servo_afastamento WHERE id_servo = %s", (id_servo,))
        ultimo = cursor.fetchone()[0] or 0
    yield id_servo
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("UPDATE servo SET status = 'Ativo' WHERE id_servo = %s", (id_servo,))
        cursor.execute(
            "DELETE FROM servo_afastamento WHERE id_servo = %s AND id_afastamento > %s",
            (id_servo, ultimo),
        )


def _afastamento_aberto(id_servo):
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("""
            SELECT motivo FROM servo_afastamento
            WHERE id_servo = %s AND data_retorno IS NULL
        """, (id_servo,))
        return cursor.fetchone()


def test_inativar_e_reativar(client, headers, id_servo):
    rota = f"/servos/{id_servo}/status"

    resposta = client.put(rota, headers=headers("coordgeral"), json={"status": "Inativo", "motivo": "  Mudou de cidade "})
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["status"] == "Inativo"
    assert _afastamento_aberto(id_servo) == ("Mudou de cidade",)

    repetido = client.put(rota, headers=headers("coordgeral"), json={"status": "Inativo"})
    assert repetido.status_code == 400, repetido.text

    resposta = client.put(rota, headers=headers("admin"), json={"status": "Ativo"})
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["status"] == "Ativo"
    assert _afastamento_aberto(id_servo) is None


def test_servo_inexistente(client, headers):
    resposta = client.put("/servos/999999/status", headers=headers("admin"), json={"status": "Inativo"})
    assert resposta.status_code == 404, resposta.text
