import difflib
import logging
from datetime import date
from typing import Optional

import psycopg2
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from ..bd.db import getConnection, releaseConnection
from ..config.security import PERFIS_ADMIN, require_perfil
from ..importacao.pastas_xlsx import MOMENTOS, PlanilhaInvalida, ler_planilha, normalizar
from ..schemas.pasta_schema import (
    EquipeImportada,
    PastaImportada,
    PastaImportResponse,
    PessoaImportada,
)

logger = logging.getLogger(__name__)

# Virada de pastas: administrador e coordenação geral
router = APIRouter(prefix="/pastas", tags=["Pastas"], dependencies=[Depends(require_perfil(*PERFIS_ADMIN))])

TAMANHO_MAXIMO = 5 * 1024 * 1024
NOME_MOMENTO = {"encontro": "Encontro", "pos": "Pós-Encontro"}


def achar(texto: str, candidatos: list[tuple[int, str]]) -> tuple[Optional[int], bool]:
    """
    Procura o texto da planilha entre (id, nome) do sistema.
    Devolve (id, conferir): conferir=True quando foi por aproximação
    (palavras a menos/a mais, acento, letra trocada). Sem certeza → (None, False).
    """
    alvo = normalizar(texto)
    if not alvo:
        return None, False

    exatos = [i for i, nome in candidatos if normalizar(nome) == alvo]
    if len(exatos) == 1:
        return exatos[0], False
    if len(exatos) > 1:
        return None, False

    # Nome incompleto ou com palavras a mais ("Agnus" → "Agnus Dei")
    palavras = set(alvo.split())
    if len(palavras) >= 2:
        contidos = [i for i, nome in candidatos
                    if palavras <= set(normalizar(nome).split()) or set(normalizar(nome).split()) <= palavras]
        if len(contidos) == 1:
            return contidos[0], True
        if len(contidos) > 1:
            return None, False

    # Letra trocada ("Kenossis" → "Kenosis")
    notas = sorted(((difflib.SequenceMatcher(None, alvo, normalizar(nome)).ratio(), i)
                    for i, nome in candidatos), reverse=True)
    if notas and notas[0][0] >= 0.88 and (len(notas) == 1 or notas[1][0] < notas[0][0] - 0.03):
        return notas[0][1], True
    return None, False


@router.post("/importar", response_model=PastaImportResponse)
def importar_pastas(
    arquivo: UploadFile = File(...),
    ano: int = Form(...),
    confirmar: bool = Form(False),
):
    """
    Importa a distribuição de pastas de um ano a partir da planilha (.xlsx).
    confirmar=false → só a prévia (nada é gravado).
    confirmar=true  → substitui os lançamentos daquele ano; só grava se não houver erros.
    As pastas do ano seguinte só passam a valer em 1º de janeiro.
    """
    ano_atual = date.today().year
    if ano not in (ano_atual, ano_atual + 1):
        raise HTTPException(status_code=422, detail=f"Só dá para importar {ano_atual} ou {ano_atual + 1}.")

    conteudo = arquivo.file.read(TAMANHO_MAXIMO + 1)
    if len(conteudo) > TAMANHO_MAXIMO:
        raise HTTPException(status_code=413, detail="Arquivo grande demais (máximo 5 MB).")
    try:
        lidas = ler_planilha(conteudo)
    except PlanilhaInvalida as e:
        raise HTTPException(status_code=422, detail=str(e))

    conn = getConnection()
    try:
        with conn.cursor() as cursor:
            cursor.execute("SELECT id_pasta, nome FROM pasta")
            pastas_sistema = cursor.fetchall()
            nome_pasta = dict(pastas_sistema)
            # Excluído não recebe pasta: se voltou, entra como cursista novo
            cursor.execute("SELECT id_servo, nome, status FROM servo WHERE status <> 'Excluido'")
            servos = cursor.fetchall()
            nome_servo = {i: n for i, n, _ in servos}
            status_servo = {i: s for i, _, s in servos}
            todos = [(i, n) for i, n, _ in servos]
            ativos = [(i, n) for i, n, s in servos if s == "Ativo"]

            erros: list[str] = []
            avisos: list[str] = []

            def pessoa(nome: str, funcao: str) -> PessoaImportada:
                # Prefere os servos ativos; só olha os inativos se não achar
                id_servo, conferir = achar(nome, ativos)
                if id_servo is None:
                    id_servo, conferir = achar(nome, todos)
                if id_servo is None:
                    avisos.append(f'{funcao}: "{nome}" não foi encontrado entre os servos (ignorado).')
                    return PessoaImportada(nome_planilha=nome)
                if status_servo[id_servo] != "Ativo":
                    avisos.append(f'{funcao}: {nome_servo[id_servo]} está {status_servo[id_servo]}.')
                return PessoaImportada(nome_planilha=nome, id_servo=id_servo,
                                       servo=nome_servo[id_servo], conferir=conferir)

            resultado: list[PastaImportada] = []
            for lida in lidas:
                id_pasta, conferir = achar(lida.funcao, pastas_sistema)
                tem_gente = any(e.coordenadores or e.membros for e in lida.equipes.values())
                if id_pasta is None and tem_gente:
                    avisos.append(f'Linha {lida.linha}: a pasta "{lida.funcao}" não foi identificada no sistema '
                                  f'(ignorada).')

                equipes = []
                for momento in MOMENTOS:
                    e = lida.equipes[momento]
                    if not (e.coordenadores or e.membros or e.ignorados):
                        continue
                    funcao = f"{lida.funcao} ({NOME_MOMENTO[momento]})"
                    equipes.append(EquipeImportada(
                        momento=momento,
                        coordenadores=[pessoa(n, funcao) for n in e.coordenadores] if id_pasta else
                                      [PessoaImportada(nome_planilha=n) for n in e.coordenadores],
                        membros=[pessoa(n, funcao) for n in e.membros] if id_pasta else
                                [PessoaImportada(nome_planilha=n) for n in e.membros],
                        ignorados=e.ignorados,
                    ))
                resultado.append(PastaImportada(
                    funcao_planilha=lida.funcao, linha=lida.linha, id_pasta=id_pasta,
                    pasta=nome_pasta.get(id_pasta), conferir=conferir, equipes=equipes,
                ))

            # Lançamentos: (servo, pasta, momento) → coordenador; quem aparece nos dois papéis fica coordenador
            lancamentos: dict[tuple[int, int, str], tuple[bool, list[PessoaImportada]]] = {}
            for p in resultado:
                if p.id_pasta is None:
                    continue
                for e in p.equipes:
                    for coordenador, lista in ((True, e.coordenadores), (False, e.membros)):
                        for pe in lista:
                            if pe.id_servo is None:
                                continue
                            chave = (pe.id_servo, p.id_pasta, e.momento)
                            coord_antes, pessoas = lancamentos.get(chave, (False, []))
                            lancamentos[chave] = (coord_antes or coordenador, pessoas + [pe])

            # Grava de verdade dentro da transação, para o banco conferir as regras
            # (repetição de pasta, Encontro/Pós); na prévia, tudo é desfeito no fim.
            cursor.execute("SELECT count(*) FROM servo_pasta WHERE ano = %s", (ano,))
            substituidos = cursor.fetchone()[0]
            cursor.execute("DELETE FROM servo_pasta WHERE ano = %s", (ano,))

            for (id_servo, id_pasta, momento), (coordenador, pessoas) in lancamentos.items():
                cursor.execute("SAVEPOINT lancamento")
                try:
                    cursor.execute(
                        "INSERT INTO servo_pasta (id_servo, id_pasta, ano, momento, coordenador) "
                        "VALUES (%s, %s, %s, %s, %s)",
                        (id_servo, id_pasta, ano, momento, coordenador))
                    cursor.execute("RELEASE SAVEPOINT lancamento")
                except psycopg2.Error as e:
                    cursor.execute("ROLLBACK TO SAVEPOINT lancamento")
                    motivo = (e.diag.message_primary if e.diag else None) or "Recusado pelo banco."
                    for pe in pessoas:
                        pe.erro = motivo
                    erros.append(f"{nome_servo[id_servo]} — {nome_pasta[id_pasta]} ({NOME_MOMENTO[momento]}): "
                                 f"{motivo}")

            cursor.execute("""
                SELECT nome FROM servo
                WHERE status = 'Ativo'
                  AND id_servo NOT IN (SELECT id_servo FROM servo_pasta WHERE ano = %s AND momento = 'pos')
                ORDER BY nome
            """, (ano,))
            avisos += [f"{n} está Ativo e ficou sem pasta no Pós-Encontro." for (n,) in cursor.fetchall()]

            cursor.execute("""
                SELECT nome FROM pasta
                WHERE perfil IS NOT NULL
                  AND id_pasta NOT IN (SELECT id_pasta FROM servo_pasta WHERE ano = %s AND momento = 'pos')
                ORDER BY nome
            """, (ano,))
            avisos += [f'A pasta "{n}" ficou sem ninguém no Pós-Encontro.' for (n,) in cursor.fetchall()]

        gravar = confirmar and not erros
        if gravar:
            conn.commit()
        else:
            conn.rollback()

    except Exception as e:
        conn.rollback()
        logger.error(f"Erro ao importar pastas: {e}")
        raise HTTPException(status_code=500, detail="Erro interno no servidor.")
    finally:
        releaseConnection(conn)

    total = len(lancamentos) - len(erros)
    if gravar:
        message = f"{total} lançamento(s) gravado(s) para {ano}."
    elif confirmar:
        message = f"Nada foi gravado: corrija o(s) {len(erros)} erro(s) e envie de novo."
    else:
        message = f"Prévia de {ano}: {total} lançamento(s), {len(erros)} erro(s), {len(avisos)} aviso(s)."
        if substituidos:
            message += f" Ao confirmar, substitui os {substituidos} lançamento(s) que já existem em {ano}."

    return PastaImportResponse(
        ano=ano, message=message, gravados=total if gravar else 0, substituidos=substituidos,
        pastas=resultado, erros=erros, avisos=avisos,
    )
