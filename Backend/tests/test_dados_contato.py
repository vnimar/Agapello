"""
Dados de contato do servo (migration 014): email, endereço, nascimento e a
idade calculada pelo banco a partir do nascimento.

Usa o servo do usuário "servo" do scripts/seed_teste.py e limpa os campos no fim.
"""
from datetime import date

import pytest

from resources.bd.db import get_connection

pytestmark = pytest.mark.usefixtures("login_obrigatorio")


def _idade_esperada(nascimento: date) -> int:
    hoje = date.today()
    return hoje.year - nascimento.year - ((hoje.month, hoje.day) < (nascimento.month, nascimento.day))


@pytest.fixture
def id_servo(usuarios):
    id_servo = usuarios["servo"][1]
    yield id_servo
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "UPDATE servo SET email = NULL, endereco = NULL, data_nascimento = NULL WHERE id_servo = %s",
            (id_servo,),
        )


def _preencher(id_servo, nascimento):
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("""
            UPDATE servo SET email = 'contato@teste.agapello', endereco = 'Rua Teste, 10 - Centro',
                             data_nascimento = %s
            WHERE id_servo = %s
        """, (nascimento, id_servo))


def test_detalhe_traz_contato_e_idade(client, headers, id_servo):
    # Aniversário amanhã: a idade ainda não virou
    amanha = date.fromordinal(date.today().toordinal() + 1)
    nascimento = amanha.replace(year=amanha.year - 30) if not (amanha.month == 2 and amanha.day == 29) else date(1996, 3, 1)
    _preencher(id_servo, nascimento)

    resposta = client.get(f"/servos/{id_servo}", headers=headers("servo"))
    assert resposta.status_code == 200, resposta.text
    dados = resposta.json()
    assert dados["email"] == "contato@teste.agapello"
    assert dados["endereco"] == "Rua Teste, 10 - Centro"
    assert dados["data_nascimento"] == nascimento.isoformat()
    assert dados["idade"] == _idade_esperada(nascimento)


def test_lista_traz_contato_e_idade(client, headers, id_servo):
    nascimento = date(2000, 1, 1)
    _preencher(id_servo, nascimento)

    resposta = client.get("/servos/", headers=headers("coordgeral"))
    assert resposta.status_code == 200, resposta.text
    servo = next(s for s in resposta.json() if s["id"] == id_servo)
    assert servo["idade"] == _idade_esperada(nascimento)
    assert servo["endereco"] == "Rua Teste, 10 - Centro"


def test_sem_nascimento_idade_vazia(client, headers, id_servo):
    resposta = client.get(f"/servos/{id_servo}", headers=headers("servo"))
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["idade"] is None
