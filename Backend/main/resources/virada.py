"""
Virada do ano: as pastas importadas em dezembro passam a valer em 1º de janeiro.

  servo Aguardando com pasta no Pós  → Ativo (o cursista fica 'promovido')
  servo Aguardando sem pasta no Pós  → apagado (o cursista deixa o movimento)
  cursista do ano anterior sem pasta → 'concluido'
  marcado para subir ao apostolado   → área do apostolado (não é inativado)
  servo Ativo sem pasta no Pós       → Inativo ("Sem pasta em <ano>")

Roda sozinha uma vez por ano (tabela virada_ano), na primeira requisição do dia
em que já houver pastas do ano importadas. A importação das pastas do ano em
curso roda de novo, à força, dentro da mesma transação.
"""
import logging
from datetime import date
from typing import Optional

from starlette.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

_ultima_conferencia: dict[str, date] = {}


def aplicar_virada(cursor, ano: int, forcar: bool = False, registrado_por: Optional[int] = None) -> bool:
    """Aplica a virada de `ano` no cursor (sem commit). Devolve False se não havia o que virar."""
    cursor.execute("SELECT 1 FROM servo_pasta WHERE ano = %s AND momento = 'pos' LIMIT 1", (ano,))
    if not cursor.fetchone():
        return False  # pastas do ano ainda não importadas: ninguém é inativado por engano

    cursor.execute("""
        INSERT INTO virada_ano (ano) VALUES (%s)
        ON CONFLICT (ano) DO UPDATE SET feita_em = now() WHERE %s
        RETURNING ano
    """, (ano, forcar))
    if not cursor.fetchone():
        return False  # já virou

    # Só os Aguardando do cursista do ano anterior (os do ano seguinte esperam a vez deles)
    com_pasta = "EXISTS (SELECT 1 FROM servo_pasta sp WHERE sp.id_servo = s.id_servo AND sp.ano = %s AND sp.momento = 'pos')"
    cursor.execute(f"""
        UPDATE servo s SET status = 'Ativo'
        FROM cursista c
        WHERE c.id_servo = s.id_servo AND c.ano = %s AND s.status = 'Aguardando' AND {com_pasta}
        RETURNING s.id_servo
    """, (ano - 1, ano))
    promovidos = [i for (i,) in cursor.fetchall()]
    cursor.execute("UPDATE cursista SET status = 'promovido' WHERE id_servo = ANY(%s)", (promovidos,))

    cursor.execute("""
        SELECT s.id_servo FROM servo s JOIN cursista c ON c.id_servo = s.id_servo
        WHERE c.ano = %s AND s.status = 'Aguardando'
    """, (ano - 1,))
    sem_pasta = [i for (i,) in cursor.fetchall()]
    cursor.execute("UPDATE cursista SET id_servo = NULL WHERE id_servo = ANY(%s)", (sem_pasta,))
    cursor.execute("DELETE FROM servo_pasta WHERE id_servo = ANY(%s)", (sem_pasta,))
    cursor.execute("DELETE FROM servo WHERE id_servo = ANY(%s)", (sem_pasta,))

    cursor.execute("UPDATE cursista SET status = 'concluido' WHERE ano = %s AND status = 'ativo'", (ano - 1,))

    # Quem sobe para o apostolado não tem pasta do discipulado e não é inativado
    subir_para_apostolado(cursor, ano)

    cursor.execute(f"""
        SELECT s.id_servo FROM servo s
        WHERE s.status = 'Ativo' AND s.area = 'discipulado' AND NOT {com_pasta}
    """, (ano,))
    inativados = [i for (i,) in cursor.fetchall()]
    for id_servo in inativados:
        cursor.execute("""
            INSERT INTO servo_afastamento (id_servo, data_saida, motivo, registrado_por)
            VALUES (%s, CURRENT_DATE, %s, %s)
        """, (id_servo, f"Sem pasta em {ano}", registrado_por))
    cursor.execute("UPDATE servo SET status = 'Inativo' WHERE id_servo = ANY(%s)", (inativados,))

    logger.info(f"Virada de {ano}: {len(promovidos)} cursista(s) promovido(s), "
                f"{len(inativados)} servo(s) inativado(s).")
    return True


def subir_para_apostolado(cursor, ano: int) -> int:
    """Quem foi marcado para subir em `ano` passa para a área do apostolado."""
    cursor.execute("""
        UPDATE servo SET area = 'apostolado', sobe_apostolado_em = NULL
        WHERE sobe_apostolado_em = %s AND status = 'Ativo' AND area = 'discipulado'
    """, (ano,))
    return cursor.rowcount


def _virada_do_dia() -> None:
    from .bd.db import get_connection  # aqui dentro: o middleware é montado antes do banco

    # Marca o dia antes: se falhar, tenta de novo amanhã, não a cada requisição
    _ultima_conferencia["dia"] = date.today()
    try:
        with get_connection() as conn, conn.cursor() as cursor:
            aplicar_virada(cursor, date.today().year)
    except Exception:
        logger.exception("Falha ao conferir a virada do ano")


class ViradaMiddleware:
    """Confere a virada do ano na primeira requisição de cada dia."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and _ultima_conferencia.get("dia") != date.today():
            await run_in_threadpool(_virada_do_dia)
        await self.app(scope, receive, send)
