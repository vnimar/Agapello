"""Login: quem entra, quem é barrado e o que acontece com a sessão de quem foi bloqueado."""
import time

import pytest

from conftest import DOMINIO, SENHA_TESTE

ATIVOS = ["admin", "coordgeral", "formacao", "coord.kairos", "tutor.kairos", "servo"]


@pytest.fixture(autouse=True)
def exige_senha_de_teste():
    if not SENHA_TESTE:
        pytest.skip("SENHA_TESTE não definida no .env.teste")


def entrar(client, headers, login, senha=None):
    return client.post(
        "/auth/login",
        headers=headers(None),
        json={"email": login + DOMINIO, "senha": senha or SENHA_TESTE},
    )


@pytest.mark.parametrize("login", ATIVOS)
def test_usuario_ativo_entra(client, headers, login):
    resposta = entrar(client, headers, login)
    assert resposta.status_code == 200, resposta.text
    corpo = resposta.json()
    assert corpo["access_token"]
    assert corpo["usuario"]["email"] == login + DOMINIO

    me = client.get("/auth/me", headers={**headers(None), "Authorization": f"Bearer {corpo['access_token']}"})
    assert me.status_code == 200
    assert me.json()["perfil"] == corpo["usuario"]["perfil"]


@pytest.mark.parametrize("login", ["inativo", "desativado"])
def test_bloqueado_nao_entra(client, headers, login):
    resposta = entrar(client, headers, login)
    assert resposta.status_code == 403, resposta.text


@pytest.mark.parametrize("login", ["inativo", "desativado"])
def test_sessao_de_bloqueado_cai(client, headers, login):
    # Token emitido antes do bloqueio deixa de valer na hora
    assert client.get("/auth/me", headers=headers(login)).status_code == 401


def test_senha_errada(client, headers):
    resposta = entrar(client, headers, "servo", "senha-errada-123")
    assert resposta.status_code == 401
    assert resposta.json()["detail"] == "Credenciais inválidas."


def test_email_inexistente_tem_a_mesma_resposta(client, headers):
    resposta = entrar(client, headers, "ninguem")
    assert resposta.status_code == 401
    assert resposta.json()["detail"] == "Credenciais inválidas."


def test_token_falso(client, headers):
    resposta = client.get("/auth/me", headers={**headers(None), "Authorization": "Bearer abc.def.ghi"})
    assert resposta.status_code == 401


def test_bloqueio_por_tentativas(client, headers):
    """5 senhas erradas bloqueiam o email (inclusive a senha certa) e a mensagem diz quanto falta."""
    from resources.config.rate_limit import MAX_TENTATIVAS
    from resources.routers import auth_router

    chave = f"testclient|formacao{DOMINIO}"
    auth_router._limitador_login.limpar(chave)
    try:
        for _ in range(MAX_TENTATIVAS):
            assert entrar(client, headers, "formacao", "senha-errada-123").status_code == 401

        resposta = entrar(client, headers, "formacao")
        assert resposta.status_code == 429
        assert "15 minutos" in resposta.json()["detail"]
        assert int(resposta.headers["retry-after"]) > 800

        # Passados os 15 minutos, um novo erro não bloqueia de novo (o contador zerou)
        limitador = auth_router._limitador_login
        limitador._bloqueado_ate[chave] = time.time() - 1
        assert entrar(client, headers, "formacao", "senha-errada-123").status_code == 401
        assert entrar(client, headers, "formacao").status_code == 200
    finally:
        auth_router._limitador_login.limpar(chave)
