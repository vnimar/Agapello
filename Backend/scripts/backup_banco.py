"""
Backup do banco (schema public) com pg_dump, em formato custom (.dump).

Uso, de dentro de Backend/:
    .venv/Scripts/python scripts/backup_banco.py            # banco real (.env)
    .venv/Scripts/python scripts/backup_banco.py --teste    # banco de teste (.env.teste)

Os arquivos vão para C:\\AgapeSys\\backups (fora do repositório, que é público).
Guarda os MANTER mais recentes de cada banco e apaga os mais antigos.

Restaurar (apaga e recria as tabelas do public no banco de destino!):
    pg_restore --clean --if-exists --no-owner --no-privileges -d "<DATABASE_URL>" arquivo.dump
Para só conferir o conteúdo:
    pg_restore --list arquivo.dump
"""
import argparse
import os
import subprocess
import sys
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote, urlparse

from dotenv import dotenv_values

BACKEND = Path(__file__).resolve().parent.parent
PASTA_BACKUP = Path(os.getenv("AGAPELLO_BACKUP_DIR", r"C:\AgapeSys\backups"))
PG_BIN = Path(os.getenv("PG_BIN", r"C:\pgtools\pgsql\bin"))
MANTER = 12


def main() -> int:
    parser = argparse.ArgumentParser(description="Backup do banco do Agapello")
    parser.add_argument("--teste", action="store_true", help="usa o banco de teste (.env.teste)")
    parser.add_argument("--motivo", default="", help="sufixo no nome do arquivo, ex.: antes-virada")
    args = parser.parse_args()

    nome = "teste" if args.teste else "real"
    env = dotenv_values(BACKEND / (".env.teste" if args.teste else ".env"))
    url = env.get("DATABASE_URL")
    if not url:
        print(f"DATABASE_URL não encontrada no .env do banco {nome}.")
        return 1

    u = urlparse(url)
    pg_env = {
        **os.environ,
        "PGHOST": u.hostname or "",
        "PGPORT": str(u.port or 5432),
        "PGUSER": unquote(u.username or ""),
        "PGPASSWORD": unquote(u.password or ""),  # pela variável, nunca na linha de comando
        "PGDATABASE": (u.path or "/postgres").lstrip("/"),
        "PGSSLMODE": "require",
    }

    PASTA_BACKUP.mkdir(parents=True, exist_ok=True)
    carimbo = datetime.now().strftime("%Y-%m-%d_%H%M")
    motivo = f"_{args.motivo}" if args.motivo else ""
    destino = PASTA_BACKUP / f"agapello-{nome}_{carimbo}{motivo}.dump"

    cmd = [str(PG_BIN / "pg_dump.exe"), "--format=custom", "--schema=public",
           "--no-owner", "--no-privileges", "--file", str(destino)]
    resultado = subprocess.run(cmd, env=pg_env, capture_output=True, text=True)
    if resultado.returncode != 0:
        destino.unlink(missing_ok=True)
        print(f"Falha no backup do banco {nome}:\n{resultado.stderr}")
        return 1

    # Confere se o arquivo abre e tem tabelas com dados
    lista = subprocess.run([str(PG_BIN / "pg_restore.exe"), "--list", str(destino)],
                           capture_output=True, text=True)
    tabelas = sum(1 for linha in lista.stdout.splitlines() if " TABLE DATA public " in linha)
    if lista.returncode != 0 or tabelas == 0:
        print(f"Backup gerado, mas a conferência falhou ({tabelas} tabelas): {destino}")
        return 1

    tamanho = destino.stat().st_size / 1024
    print(f"Backup do banco {nome} OK: {destino} ({tamanho:.0f} KB, {tabelas} tabelas)")

    # Rotação: só os automáticos (sem motivo) entram na contagem; os com motivo ficam
    automaticos = sorted(p for p in PASTA_BACKUP.glob(f"agapello-{nome}_*.dump")
                         if p.stem.count("_") == 2)
    for antigo in automaticos[:-MANTER]:
        antigo.unlink()
        print(f"Apagado backup antigo: {antigo.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
