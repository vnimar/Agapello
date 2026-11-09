"""
Subida para o apostolado: marcada em dezembro, vale na virada; quem está no
apostolado sai das listas do discipulado e não acessa nada dele.
"""
from datetime import date

import pytest

from resources.bd.db import get_connection, getConnection, releaseConnection
from resources.virada import aplicar_virada

pytestmark = pytest.mark.usefixtures("login_obrigatorio")

ANO = date.today().year + 1


@pytest.fixture(autouse=True)
def devolver_ao_discipulado():
    yield
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("UPDATE servo SET area = 'discipulado', sobe_apostolado_em = NULL "
                       "WHERE area <> 'discipulado' OR sobe_apostolado_em IS NOT NULL")


def id_do_servo(nome):
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT id_servo FROM servo WHERE nome = %s", (nome,))
        return cursor.fetchone()[0]


def marcar(client, headers, ids, ano=ANO, login="admin"):
    return client.put("/servos/apostolado", headers=headers(login), json={"ano": ano, "ids": ids})


def test_marcar_para_o_ano_seguinte_so_vale_na_virada(client, headers):
    servo3 = id_do_servo("Teste Servo 3")
    resposta = marcar(client, headers, [servo3])
    assert resposta.status_code == 200, resposta.text
    assert "1º de janeiro" in resposta.json()["message"]

    lista = client.get("/servos/apostolado", headers=headers("admin")).json()
    assert [s["marcado"] for s in lista["servos"] if s["id"] == servo3] == [True]
    # Ainda é do discipulado até a virada
    status = {s["id"]: s["status"] for s in client.get("/servos/", headers=headers("admin")).json()}
    assert status[servo3] == "Ativo"


def test_remarcar_substitui_a_marcacao_do_ano(client, headers):
    servo3, servo4 = id_do_servo("Teste Servo 3"), id_do_servo("Teste Servo 4")
    marcar(client, headers, [servo3])
    marcar(client, headers, [servo4])
    marcados = {s["id"] for s in client.get("/servos/apostolado", headers=headers("admin")).json()["servos"]
                if s["marcado"]}
    assert marcados == {servo4}


def test_elegivel_so_com_3_anos_completos(client, headers):
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute("SELECT id_servo, ano_ingresso FROM servo WHERE status = 'Ativo'")
        ingresso = dict(cursor.fetchall())
    for s in client.get("/servos/apostolado", headers=headers("admin")).json()["servos"]:
        assert s["elegivel"] == (0 < ingresso[s["id"]] <= ANO - 4)


def test_so_administrador_marca(client, headers):
    assert marcar(client, headers, [], login="coordgeral").status_code == 403
    assert client.get("/servos/apostolado", headers=headers("formacao")).status_code == 403


def test_previa_das_pastas_nao_inativa_quem_sobe(client, headers):
    from test_importar_pastas import enviar, planilha  # noqa: E402

    marcar(client, headers, [id_do_servo("Teste Servo 3")])
    corpo = enviar(client, headers("admin"), planilha([
        {"funcao": "Música", "e": 1, "p": 1, "pc": ["Teste Servo 1"]},
    ])).json()
    assert "Teste Servo 3" in corpo["sobem_apostolado"]
    assert "Teste Servo 3" not in corpo["servos_sem_pasta"]


def test_virada_sobe_e_nao_inativa(client, headers):
    servo3 = id_do_servo("Teste Servo 3")
    marcar(client, headers, [servo3])
    conn = getConnection()
    try:
        with conn.cursor() as cursor:
            # Pastas do ano seguinte (a virada só roda com elas)
            cursor.execute("""INSERT INTO servo_pasta (id_servo, id_pasta, ano, momento)
                              SELECT %s, id_pasta, %s, 'pos' FROM pasta WHERE nome = 'Música'""",
                           (id_do_servo("Teste Servo 1"), ANO))
            cursor.execute("DELETE FROM virada_ano WHERE ano = %s", (ANO,))
            assert aplicar_virada(cursor, ANO)
            cursor.execute("SELECT status, area, sobe_apostolado_em FROM servo WHERE id_servo = %s", (servo3,))
            assert cursor.fetchone() == ("Ativo", "apostolado", None)
    finally:
        conn.rollback()
        releaseConnection(conn)


def test_marcar_o_ano_atual_vale_na_hora(client, headers):
    servo3 = id_do_servo("Teste Servo 3")
    resposta = marcar(client, headers, [servo3], ano=ANO - 1)
    assert "agora" in resposta.json()["message"]
    status = {s["id"]: s["status"] for s in client.get("/servos/", headers=headers("admin")).json()}
    assert status[servo3] == "Apostolado"  # fica com o nome nas chamadas antigas
    resumo = client.get("/frequencia/servos", headers=headers("formacao")).json()["data"]
    assert servo3 not in [r["id_servo"] for r in resumo]
    quadrante = client.get("/quadrante", headers=headers("admin")).json()
    assert servo3 not in [s["id"] for s in quadrante["servos"]]


def test_quem_esta_no_apostolado_nao_ve_o_discipulado(client, headers, usuarios):
    marcar(client, headers, [usuarios["servo"][1]], ano=ANO - 1)

    me = client.get("/auth/me", headers=headers("servo"))
    assert me.status_code == 200 and me.json()["area"] == "apostolado"
    for rota in ("/missao/", "/quadrante", "/missao/proxima"):
        resposta = client.get(rota, headers=headers("servo"))
        assert resposta.status_code == 403, rota
        assert "apostolado" in resposta.json()["detail"]
