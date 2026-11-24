"""
Simula a virada do ano (1º de janeiro) no banco de TESTE, para ensaiar antes da real.

A virada de verdade roda sozinha no servidor em 1º de janeiro (resources/virada.py).
Este script chama a mesma função, para o ano pedido, e mostra o que ela fez.

Uso, de dentro de Backend/:
    .venv/Scripts/python scripts/simular_virada.py 2027            # ensaio: mostra e desfaz
    .venv/Scripts/python scripts/simular_virada.py 2027 --gravar   # grava no banco de teste

Nunca roda contra o banco real (.env). Faça um backup do teste antes de --gravar:
    .venv/Scripts/python scripts/backup_banco.py --teste --motivo antes-simulacao
"""
import argparse
import os
import sys
from pathlib import Path

from dotenv import dotenv_values

BACKEND = Path(__file__).resolve().parent.parent


def main() -> int:
    parser = argparse.ArgumentParser(description="Simula a virada do ano no banco de teste")
    parser.add_argument("ano", type=int)
    parser.add_argument("--gravar", action="store_true", help="grava (sem isto, desfaz no fim)")
    args = parser.parse_args()

    url = dotenv_values(BACKEND / ".env.teste").get("DATABASE_URL")
    if not url or url == dotenv_values(BACKEND / ".env").get("DATABASE_URL"):
        print("Abortado: o .env.teste não existe ou aponta para o banco real.")
        return 1
    os.environ["DATABASE_URL"] = url
    sys.path.insert(0, str(BACKEND / "main"))
    from resources.bd.db import getConnection, releaseConnection
    from resources.virada import aplicar_virada

    def nomes(cursor, sql, params=()):
        cursor.execute(sql, params)
        return [n for (n,) in cursor.fetchall()]

    conn = getConnection()
    try:
        with conn.cursor() as cursor:
            antes_ativos = set(nomes(cursor, "SELECT nome FROM servo WHERE status = 'Ativo' AND area = 'discipulado'"))
            excecoes = nomes(cursor, """
                SELECT s.nome || ': ' || e.motivo FROM servo_excecao_sem_pasta e
                JOIN servo s USING (id_servo) WHERE e.ano = %s ORDER BY 1""", (args.ano,))

            # Ensaio: a virada deste ano pode já ter sido simulada; roda de novo
            cursor.execute("DELETE FROM virada_ano WHERE ano = %s", (args.ano,))
            if not aplicar_virada(cursor, args.ano):
                print(f"Nada a fazer: não há pastas de {args.ano} no Pós-Encontro. Importe as pastas antes.")
                conn.rollback()
                return 1

            ativos = set(nomes(cursor, "SELECT nome FROM servo WHERE status = 'Ativo' AND area = 'discipulado'"))
            promovidos = nomes(cursor, "SELECT nome FROM cursista WHERE ano = %s AND status = 'promovido' ORDER BY 1",
                               (args.ano - 1,))
            concluidos = nomes(cursor, "SELECT nome FROM cursista WHERE ano = %s AND status = 'concluido' ORDER BY 1",
                               (args.ano - 1,))
            apostolado = nomes(cursor, "SELECT nome FROM servo WHERE area = 'apostolado' AND status = 'Ativo' ORDER BY 1")
            inativados = sorted(antes_ativos - ativos - set(apostolado))

            def bloco(titulo, lista):
                print(f"\n{titulo} ({len(lista)})")
                for n in lista:
                    print(f"  • {n}")

            print(f"Virada de {args.ano} no banco de TESTE")
            bloco("Cursistas que viraram servos", promovidos)
            bloco("Cursistas sem pasta (deixaram o movimento)", concluidos)
            bloco("Servos inativados (sem pasta)", inativados)
            bloco("Exceções: sem pasta, continuam ativos", excecoes)
            bloco("Na área do apostolado", apostolado)
            print(f"\nServos ativos do discipulado: {len(antes_ativos)} antes → {len(ativos)} depois")

        if args.gravar:
            conn.commit()
            print("\nGRAVADO no banco de teste.")
        else:
            conn.rollback()
            print("\nEnsaio: nada foi gravado (use --gravar).")
    finally:
        releaseConnection(conn)
    return 0


if __name__ == "__main__":
    sys.exit(main())
