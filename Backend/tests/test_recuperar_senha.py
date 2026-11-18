"""Recuperação de senha pelo email: código, tentativas, limites e sessões derrubadas."""
import pytest

from conftest import DOMINIO, SENHA_TESTE
from resources.bd.db import get_connection
from resources.config import rate_limit
from resources.config.security import hash_senha
from resources.routers import auth_router

LOGIN = "servo"
EMAIL = LOGIN + DOMINIO
SENHA_NOVA = "senha-nova-de-teste-1"


@pytest.fixture(autouse=True)
def ambiente(usuarios, monkeypatch):
    """Captura os emails em vez de enviar e devolve a conta ao estado do seed no fim."""
    if not SENHA_TESTE:
        pytest.skip("SENHA_TESTE não definida no .env.teste")

    enviados = []
    monkeypatch.setattr(auth_router, "enviar_email",
                        lambda para, nome, assunto, texto, html: enviados.append((para, texto)) or True)

    def limpar_limites():
        for limitador in (rate_limit.limitador_pedido_email, rate_limit.limitador_recuperacao_ip,
                          rate_limit.limitador_login):
            limitador._falhas.clear()
            limitador._bloqueado_ate.clear()

    limpar_limites()
    yield enviados
    limpar_limites()
    with get_connection() as conn, conn.cursor() as cursor:
        cursor.execute(
            "UPDATE usuario SET senha_hash = %s, trocar_senha = false, versao_sessao = 0 WHERE id_usuario = %s",
            (hash_senha(SENHA_TESTE), usuarios[LOGIN][0])
        )
        cursor.execute("DELETE FROM recuperacao_senha WHERE id_usuario = %s", (usuarios[LOGIN][0],))


def pedir(client, headers, email=EMAIL):
    return client.post("/auth/recuperar-senha", headers=headers(None), json={"email": email})


def redefinir(client, headers, codigo, senha=SENHA_NOVA, email=EMAIL):
    return client.post("/auth/redefinir-senha", headers=headers(None),
                       json={"email": email, "codigo": codigo, "senha_nova": senha})


def codigo_do_email(enviados) -> str:
    para, texto = enviados[-1]
    assert para == EMAIL
    return texto.split("é: ")[1][:6]


def test_fluxo_completo(client, headers, ambiente):
    sessao_antiga = headers(LOGIN)
    assert client.get("/auth/me", headers=sessao_antiga).status_code == 200

    resposta = pedir(client, headers)
    assert resposta.status_code == 200
    codigo = codigo_do_email(ambiente)

    resposta = redefinir(client, headers, codigo)
    assert resposta.status_code == 200, resposta.text
    token = resposta.json()["access_token"]
    assert client.get("/auth/me", headers={**headers(None), "Authorization": f"Bearer {token}"}).status_code == 200

    # Sessões de antes da redefinição caem
    assert client.get("/auth/me", headers=sessao_antiga).status_code == 401
    # Senha nova entra; o código não serve duas vezes
    login = client.post("/auth/login", headers=headers(None), json={"email": EMAIL, "senha": SENHA_NOVA})
    assert login.status_code == 200
    assert redefinir(client, headers, codigo).status_code == 400


def test_email_sem_conta_tem_a_mesma_resposta(client, headers, ambiente):
    com_conta = pedir(client, headers).json()
    sem_conta = pedir(client, headers, "ninguem" + DOMINIO).json()
    assert com_conta == sem_conta
    assert len(ambiente) == 1  # só a conta que existe recebeu


def test_conta_inativa_nao_recebe(client, headers, ambiente):
    assert pedir(client, headers, "inativo" + DOMINIO).status_code == 200
    assert ambiente == []


def test_codigo_errado_cai_depois_de_5(client, headers, ambiente):
    pedir(client, headers)
    codigo = codigo_do_email(ambiente)
    errado = "000000" if codigo != "000000" else "111111"
    for _ in range(auth_router.CODIGO_TENTATIVAS):
        assert redefinir(client, headers, errado).status_code == 400
    assert redefinir(client, headers, codigo).status_code == 400


def test_codigo_novo_invalida_o_anterior(client, headers, ambiente):
    pedir(client, headers)
    primeiro = codigo_do_email(ambiente)
    pedir(client, headers)
    segundo = codigo_do_email(ambiente)
    if primeiro != segundo:
        assert redefinir(client, headers, primeiro).status_code == 400
    assert redefinir(client, headers, segundo).status_code == 200


def test_limite_de_pedidos_por_email(client, headers, ambiente):
    for _ in range(3):
        assert pedir(client, headers).status_code == 200
    assert pedir(client, headers).status_code == 429


def test_senha_curta_recusada(client, headers, ambiente):
    pedir(client, headers)
    assert redefinir(client, headers, codigo_do_email(ambiente), senha="curta").status_code == 422


def test_redefinir_tira_bloqueio_de_login(client, headers, ambiente):
    for _ in range(rate_limit.MAX_TENTATIVAS):
        client.post("/auth/login", headers=headers(None), json={"email": EMAIL, "senha": "errada-123"})
    assert client.post("/auth/login", headers=headers(None),
                       json={"email": EMAIL, "senha": SENHA_TESTE}).status_code == 429

    pedir(client, headers)
    assert redefinir(client, headers, codigo_do_email(ambiente)).status_code == 200
    assert client.post("/auth/login", headers=headers(None),
                       json={"email": EMAIL, "senha": SENHA_NOVA}).status_code == 200


def test_reset_do_admin_derruba_sessao_e_bloqueio(client, headers, usuarios):
    sessao_antiga = headers(LOGIN)
    for _ in range(rate_limit.MAX_TENTATIVAS):
        client.post("/auth/login", headers=headers(None), json={"email": EMAIL, "senha": "errada-123"})

    resposta = client.post(f"/usuarios/{usuarios[LOGIN][0]}/resetar-senha", headers=headers("admin"))
    assert resposta.status_code == 200
    temporaria = resposta.json()["senha_temporaria"]

    assert client.get("/auth/me", headers=sessao_antiga).status_code == 401
    assert client.post("/auth/login", headers=headers(None),
                       json={"email": EMAIL, "senha": temporaria}).status_code == 200
