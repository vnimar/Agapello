"""
Sobe a API no computador usando o banco de TESTE, para testar o app no celular
com os usuários fictícios do seed_teste.py.

Uso, dentro da pasta Backend:
    .venv\\Scripts\\python.exe scripts\\servidor_teste.py            (login opcional, como em produção hoje)
    .venv\\Scripts\\python.exe scripts\\servidor_teste.py --obrigatorio

No app (pasta Frontend), crie um .env.local com o IP do computador mostrado abaixo:
    EXPO_PUBLIC_API_URL=http://<IP>:8000

O JWT_SECRET é gerado na hora (nunca o do Render): os ids dos usuários de teste
coincidem com ids reais, e um token do teste não pode valer em produção.
"""
import os
import re
import secrets
import socket
import sys
from pathlib import Path

import uvicorn
from dotenv import dotenv_values

BACKEND = Path(__file__).resolve().parent.parent


def projeto(url: str) -> str:
    achado = re.search(r"postgres\.([a-z0-9]+)[:@]", url or "")
    return achado.group(1) if achado else url


def ip_local() -> str:
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
            s.connect(("8.8.8.8", 80))
            return s.getsockname()[0]
    except OSError:
        return "127.0.0.1"


def main() -> int:
    real = dotenv_values(BACKEND / ".env")
    teste = dotenv_values(BACKEND / ".env.teste")
    url = teste.get("DATABASE_URL", "")

    if not url or "SENHA_AQUI" in url:
        print("Preencha o DATABASE_URL do Backend/.env.teste")
        return 1
    if projeto(url) == projeto(real.get("DATABASE_URL", "")):
        print("ABORTADO: o .env.teste aponta para o banco real.")
        return 1

    # Definidas antes de importar o app (o load_dotenv dele não sobrescreve)
    os.environ["DATABASE_URL"] = url
    os.environ["API_KEY"] = real.get("API_KEY") or "api-key-local"  # a mesma que o app já usa
    os.environ["JWT_SECRET"] = secrets.token_urlsafe(32)
    os.environ["LOGIN_OBRIGATORIO"] = "true" if "--obrigatorio" in sys.argv else "false"

    print(f"\nBanco de TESTE · login obrigatório: {os.environ['LOGIN_OBRIGATORIO']}")
    print(f"No Frontend/.env.local:  EXPO_PUBLIC_API_URL=http://{ip_local()}:8000\n")

    sys.path.insert(0, str(BACKEND / "main"))
    from main import app

    uvicorn.run(app, host="0.0.0.0", port=8000)
    return 0


if __name__ == "__main__":
    sys.exit(main())
