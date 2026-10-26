"""
Matriz de permissões: quem pode chamar cada rota.

Cada rota é chamada por todos os perfis (e sem login). "Liberado" significa
passar da checagem de acesso; o resultado depois disso não importa aqui.
Por isso as rotas de escrita recebem corpo vazio ({}): quem tem acesso recebe
422 (dados inválidos) e nada é gravado; quem não tem recebe 401/403 antes.

Ao criar uma rota nova, acrescente-a em ROTAS.
"""
import pytest

TODOS = {"servo", "formacao", "coord.kairos", "tutor.kairos", "coordgeral", "admin"}
COORD_SERVOS = {"formacao", "coordgeral", "admin"}
ADMIN_CALENDARIO = {"coordgeral", "admin"}
SO_ADMIN = {"admin"}

INEXISTENTE = 999999

# (método, rota, corpo, perfis com acesso)
ROTAS = [
    # Calendário
    ("GET", "/missao/", None, TODOS),
    ("GET", "/missao/proxima", None, TODOS),
    ("GET", "/missao/ultimas", None, TODOS),
    ("POST", "/missao/", {}, ADMIN_CALENDARIO),
    ("PUT", f"/missao/{INEXISTENTE}", {}, ADMIN_CALENDARIO),
    ("DELETE", f"/missao/{INEXISTENTE}", None, ADMIN_CALENDARIO),
    ("POST", "/missao/importar", {}, ADMIN_CALENDARIO),

    # Servos e chamada de servos
    ("GET", "/servos/", None, COORD_SERVOS),
    ("GET", "/frequencia/servos", None, COORD_SERVOS),
    ("GET", "/frequencia/missoes", None, COORD_SERVOS),
    ("GET", f"/frequencia/missao/{INEXISTENTE}", None, COORD_SERVOS),
    ("POST", "/frequencia/register", {}, COORD_SERVOS),
    ("PUT", "/frequencia/update", {}, COORD_SERVOS),

    # Contas
    ("GET", "/auth/me", None, TODOS),
    ("GET", "/auth/me/resumo", None, TODOS),
    ("POST", "/auth/register", {}, SO_ADMIN),
    ("GET", "/usuarios/", None, SO_ADMIN),
    ("POST", "/usuarios/", {}, SO_ADMIN),
    ("PUT", f"/usuarios/{INEXISTENTE}", {}, SO_ADMIN),
    ("POST", f"/usuarios/{INEXISTENTE}/resetar-senha", None, SO_ADMIN),
]

PERFIS = sorted(TODOS) + [None]  # None = sem login

CASOS = [
    pytest.param(metodo, rota, corpo, perfil, perfil in permitidos,
                 id=f"{metodo} {rota} [{perfil or 'sem login'}]")
    for metodo, rota, corpo, permitidos in ROTAS
    for perfil in PERFIS
]


def chamar(client, metodo, rota, headers, corpo=None):
    return client.request(metodo, rota, headers=headers, json=corpo)


@pytest.mark.usefixtures("login_obrigatorio")
@pytest.mark.parametrize("metodo, rota, corpo, perfil, liberado", CASOS)
def test_matriz(client, headers, metodo, rota, corpo, perfil, liberado):
    resposta = chamar(client, metodo, rota, headers(perfil), corpo)

    if liberado:
        assert resposta.status_code not in (401, 403), resposta.text
        assert resposta.status_code < 500, resposta.text
    elif perfil is None:
        assert resposta.status_code == 401, resposta.text
    else:
        assert resposta.status_code == 403, resposta.text


# ── Escopo: cada um vê o próprio cadastro ────────────────────────────────────

@pytest.mark.usefixtures("login_obrigatorio")
@pytest.mark.parametrize("perfil", ["servo", "coord.kairos", "tutor.kairos"])
def test_ve_o_proprio_cadastro(client, headers, usuarios, perfil):
    id_servo = usuarios[perfil][1]
    resposta = client.get(f"/servos/{id_servo}", headers=headers(perfil))
    assert resposta.status_code == 200, resposta.text
    assert resposta.json()["id"] == id_servo


@pytest.mark.usefixtures("login_obrigatorio")
@pytest.mark.parametrize("perfil", ["servo", "coord.kairos", "tutor.kairos"])
def test_nao_ve_cadastro_de_outro_servo(client, headers, usuarios, perfil):
    outro = usuarios["coord.maranata"][1]
    resposta = client.get(f"/servos/{outro}", headers=headers(perfil))
    assert resposta.status_code == 403, resposta.text


@pytest.mark.usefixtures("login_obrigatorio")
@pytest.mark.parametrize("perfil", sorted(COORD_SERVOS))
def test_coordenacao_ve_cadastro_de_qualquer_servo(client, headers, usuarios, perfil):
    outro = usuarios["servo"][1]
    resposta = client.get(f"/servos/{outro}", headers=headers(perfil))
    assert resposta.status_code == 200, resposta.text


# ── Transição (LOGIN_OBRIGATORIO desligado, como está em produção) ───────────

@pytest.mark.usefixtures("login_obrigatorio")
def test_lista_de_servos_sem_barra_nao_redireciona(client, headers):
    # O redirect para "/servos/" perdia o token no app (401 → logout)
    resposta = client.get("/servos", headers=headers("coordgeral"), follow_redirects=False)
    assert resposta.status_code == 200, resposta.text


@pytest.mark.usefixtures("login_opcional")
class TestTransicao:

    def test_sem_login_continua_vendo_o_calendario(self, client, headers):
        assert client.get("/missao/proxima", headers=headers(None)).status_code == 200

    def test_sem_login_continua_vendo_os_servos(self, client, headers):
        assert client.get("/servos/", headers=headers(None)).status_code == 200

    def test_sem_login_continua_lancando_frequencia(self, client, headers):
        # 422 = passou da checagem de acesso (corpo vazio, nada gravado)
        assert client.post("/frequencia/register", headers=headers(None), json={}).status_code == 422

    def test_sem_login_edita_missao_so_com_pin(self, client, headers):
        sem_pin = client.post("/missao/", headers=headers(None), json={})
        com_pin = client.post("/missao/", headers={**headers(None), "X-Admin-Pin": "pin-dos-testes"}, json={})
        assert sem_pin.status_code == 403
        assert com_pin.status_code == 422

    def test_logado_ja_respeita_o_perfil(self, client, headers):
        assert client.get("/servos/", headers=headers("servo")).status_code == 403
        assert client.post("/missao/", headers=headers("formacao"), json={}).status_code == 403


@pytest.mark.usefixtures("login_obrigatorio")
def test_pin_nao_vale_com_login_obrigatorio(client, headers):
    resposta = client.post("/missao/", headers={**headers(None), "X-Admin-Pin": "pin-dos-testes"}, json={})
    assert resposta.status_code == 401


def test_sem_api_key_e_recusado(client):
    assert client.get("/missao/proxima").status_code == 403


# ── Conexões ─────────────────────────────────────────────────────────────────

@pytest.mark.usefixtures("login_obrigatorio")
def test_rotas_devolvem_a_conexao_ao_pool(client, headers, usuarios):
    # O pool tem 10 conexões; se alguma rota não devolver, isto esgota e dá erro
    for _ in range(15):
        assert client.get("/servos/", headers=headers("admin")).status_code == 200
        assert client.get(f"/servos/{usuarios['servo'][1]}", headers=headers("servo")).status_code == 200


# ── Configuração lida pelo app ───────────────────────────────────────────────

@pytest.mark.parametrize("ligado", [True, False])
def test_config_informa_se_o_login_e_obrigatorio(client, headers, monkeypatch, ligado):
    from resources.config import security
    monkeypatch.setattr(security, "LOGIN_OBRIGATORIO", ligado)
    resposta = client.get("/auth/config", headers=headers(None))
    assert resposta.status_code == 200
    assert resposta.json() == {"login_obrigatorio": ligado}
