import logging
from datetime import date
from typing import Optional

import psycopg2.extras
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from ..bd.db import get_connection
from ..config.security import get_current_user
from ..schemas.servo_schema import MinhaPasta

logger = logging.getLogger(__name__)

# Quadrante: os dados de todos os servos ativos e dos cursistas do ano, abertos
# a qualquer servo logado. Sem frequência (essa fica com quem cuida dos servos).
# Sempre exige login, mesmo com o LOGIN_OBRIGATORIO desligado: são dados pessoais.
router = APIRouter(prefix="/quadrante", tags=["Quadrante"], dependencies=[Depends(get_current_user)])


class DadosPessoais(BaseModel):
    nome: str
    apelido: Optional[str] = None
    telefone: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    data_nascimento: Optional[date] = None
    idade: Optional[int] = None  # calculada pelo banco (fn_idade)
    responsavel_nome: Optional[str] = None
    responsavel_telefone: Optional[str] = None


class ServoQuadrante(DadosPessoais):
    id: int
    ano_ingresso: Optional[int] = None
    pastas: list[MinhaPasta]  # do ano: onde serve no encontro e no pós


class CursistaQuadrante(DadosPessoais):
    id_cursista: int
    comunidade: Optional[str] = None


class Quadrante(BaseModel):
    ano: int
    servos: list[ServoQuadrante]
    cursistas: list[CursistaQuadrante]


DADOS = """{t}.nome, {t}.apelido, {t}.telefone, {t}.email, {t}.endereco, {t}.data_nascimento,
           fn_idade({t}.data_nascimento) AS idade, {t}.responsavel_nome, {t}.responsavel_telefone"""


@router.get("/", response_model=Quadrante)
@router.get("", response_model=Quadrante, include_in_schema=False)
def ver_quadrante():
    ano = date.today().year
    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(f"""
                SELECT s.id_servo AS id, {DADOS.format(t="s")}, s.ano_ingresso,
                       COALESCE(json_agg(json_build_object(
                                    'nome', p.nome, 'momento', sp.momento, 'coordenador', sp.coordenador)
                                ORDER BY sp.momento, p.nome) FILTER (WHERE p.nome IS NOT NULL),
                                '[]') AS pastas
                FROM servo s
                LEFT JOIN servo_pasta sp ON sp.id_servo = s.id_servo AND sp.ano = %(ano)s
                LEFT JOIN pasta p ON p.id_pasta = sp.id_pasta
                WHERE s.status = 'Ativo'
                GROUP BY s.id_servo
                ORDER BY COALESCE(s.apelido, s.nome), s.nome
            """, {"ano": ano})
            servos = cursor.fetchall()

            cursor.execute(f"""
                SELECT c.id_cursista, {DADOS.format(t="c")}, co.nome AS comunidade
                FROM cursista c
                LEFT JOIN comunidade co ON co.id_comunidade = c.id_comunidade
                WHERE c.ano = %(ano)s AND c.status IN ('ativo', 'concluido', 'promovido')
                ORDER BY co.nome, COALESCE(c.apelido, c.nome), c.nome
            """, {"ano": ano})
            cursistas = cursor.fetchall()

    except Exception as e:
        logger.error(f"Erro ao montar o quadrante: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")

    return Quadrante(ano=ano, servos=servos, cursistas=cursistas)
