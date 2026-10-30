"""
Configuração dos testes.

Os testes rodam contra o banco de TESTE (Backend/.env.teste), com os usuários
fictícios do scripts/seed_teste.py. Nunca contra o banco real.

Uso, dentro da pasta Backend:
    .venv\\Scripts\\python.exe scripts\\seed_teste.py   (se o banco de teste estiver vazio/bagunçado)
    .venv\\Scripts\\python.exe -m pytest
"""
import os
import re
import sys
from pathlib import Path

import pytest
from dotenv import dotenv_values

BACKEND = Path(__file__).resolve().parent.parent
DOMINIO = "@teste.agapello"


def _projeto(url: str) -> str:
    achado = re.search(r"postgres\.([a-z0-9]+)[:@]", url or "")
    return achado.group(1) if achado else url


# ── Ambiente: precisa estar pronto ANTES de importar o app ───────────────────
# (o app lê as variáveis e abre a conexão com o banco ao ser importado; o
# load_dotenv do app não sobrescreve o que já estiver definido aqui)

_teste = dotenv_values(BACKEND / ".env.teste")
_url_teste = _teste.get("DATABASE_URL", "")
_url_real = dotenv_values(BACKEND / ".env").get("DATABASE_URL", "")

if not _url_teste or "SENHA_AQUI" in _url_teste:
    sys.exit("Testes abortados: preencha o DATABASE_URL do Backend/.env.teste.")
if _projeto(_url_teste) == _projeto(_url_real):
    sys.exit("Testes abortados: o .env.teste aponta para o banco real.")

os.environ["DATABASE_URL"] = _url_teste
os.environ["API_KEY"] = "api-key-dos-testes"
os.environ["JWT_SECRET"] = "jwt-secret-dos-testes"
SENHA_TESTE = _teste.get("SENHA_TESTE", "")

sys.path.insert(0, str(BACKEND / "main"))

from fastapi.testclient import TestClient  # noqa: E402
from main import app  # noqa: E402
from resources.bd.db import get_connection  # noqa: E402
from resources.config import security  # noqa: E402

API_KEY = {"X-API-Key": os.environ["API_KEY"]}


@pytest.fixture(scope="session")
def client():
    return TestClient(app)


@pytest.fixture(scope="session")
def usuarios():
    """{login: (id_usuario, id_servo)} dos usuários criados pelo seed."""
    with get_connection() as conn:
        with conn.cursor() as cursor:
            cursor.execute(
                "SELECT email, id_usuario, id_servo FROM usuario WHERE email LIKE %s",
                ("%" + DOMINIO,)
            )
            linhas = cursor.fetchall()
    if not linhas:
        pytest.exit("Banco de teste vazio: rode scripts/seed_teste.py antes.")
    if any(not email.endswith(DOMINIO) for email, *_ in linhas):
        pytest.exit("Há usuários reais neste banco. Testes abortados.")
    return {email.removesuffix(DOMINIO): (id_usuario, id_servo) for email, id_usuario, id_servo in linhas}


@pytest.fixture(scope="session")
def headers(usuarios):
    """headers("servo") → cabeçalhos de quem está logado como esse usuário; headers(None) → sem login."""
    def _headers(login):
        if login is None:
            return dict(API_KEY)
        token = security.gerar_token(usuarios[login][0])
        return {**API_KEY, "Authorization": f"Bearer {token}"}
    return _headers


@pytest.fixture
def login_obrigatorio(monkeypatch):
    monkeypatch.setattr(security, "LOGIN_OBRIGATORIO", True)


@pytest.fixture
def login_opcional(monkeypatch):
    monkeypatch.setattr(security, "LOGIN_OBRIGATORIO", False)
