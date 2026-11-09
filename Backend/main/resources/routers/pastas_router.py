import difflib
import logging
from datetime import date
from typing import Hashable, Optional

import psycopg2
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile

from ..bd.db import getConnection, releaseConnection
from ..config.auditoria import fora_do_historico
from ..config.security import PERFIS_ADMIN, require_perfil
from ..importacao.pastas_xlsx import MOMENTOS, PlanilhaInvalida, ler_planilha, normalizar
from ..schemas.auth_schema import UsuarioLogado
from ..virada import aplicar_virada
from ..schemas.pasta_schema import (
    EquipeImportada,
    PastaImportada,
    PastaImportResponse,
    PessoaImportada,
)

logger = logging.getLogger(__name__)

# Virada de pastas: administrador e coordenação geral
# Guarda o ano importado e os 2 anteriores (o que as regras de repetição e de
# ciclo usam); o que for mais antigo é apagado ao gravar
ANOS_GUARDADOS = 2

router = APIRouter(prefix="/pastas", tags=["Pastas"], dependencies=[Depends(require_perfil(*PERFIS_ADMIN))])

TAMANHO_MAXIMO = 5 * 1024 * 1024
NOME_MOMENTO = {"encontro": "Encontro", "pos": "Pós-Encontro"}


def achar(texto: str, candidatos: list[tuple[Hashable, str]]) -> tuple[Optional[Hashable], bool]:
    """
    Procura o texto da planilha entre (id, nome) do sistema. O mesmo id pode vir
    mais de uma vez (nome completo e apelido).
    Devolve (id, conferir): conferir=True quando foi por aproximação
    (palavras a menos/a mais, acento, letra trocada). Sem certeza → (None, False).
    """
    alvo = normalizar(texto)
    if not alvo:
        return None, False

    exatos = {i for i, nome in candidatos if normalizar(nome) == alvo}
    if len(exatos) == 1:
        return exatos.pop(), False
    if len(exatos) > 1:
        return None, False

    # Nome incompleto ou com palavras a mais ("Agnus" → "Agnus Dei")
    palavras = set(alvo.split())
    if len(palavras) >= 2:
        contidos = {i for i, nome in candidatos
                    if palavras <= set(normalizar(nome).split()) or set(normalizar(nome).split()) <= palavras}
        if len(contidos) == 1:
            return contidos.pop(), True
        if len(contidos) > 1:
            return None, False

    # Letra trocada ("Kenossis" → "Kenosis"): vale a melhor nota de cada id
    melhor: dict[Hashable, float] = {}
    for i, nome in candidatos:
        melhor[i] = max(melhor.get(i, 0.0), difflib.SequenceMatcher(None, alvo, normalizar(nome)).ratio())
    notas = sorted(((nota, i) for i, nota in melhor.items()), key=lambda n: n[0], reverse=True)
    if notas and notas[0][0] >= 0.88 and (len(notas) == 1 or notas[1][0] < notas[0][0] - 0.03):
        return notas[0][1], True
    return None, False


def com_apelido(nome: str, apelido: Optional[str]) -> str:
    return f"{nome} ({apelido})" if apelido else nome


@router.post("/importar", response_model=PastaImportResponse)
def importar_pastas(
    request: Request,
    arquivo: UploadFile = File(...),
    ano: int = Form(...),
    confirmar: bool = Form(False),
    usuario: Optional[UsuarioLogado] = Depends(require_perfil(*PERFIS_ADMIN)),
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
            cursor.execute("SELECT id_pasta, nome, momento, id_pasta_principal FROM pasta")
            linhas_pasta = cursor.fetchall()
            pastas_sistema = [(i, n) for i, n, _, _ in linhas_pasta]
            nome_pasta = dict(pastas_sistema)
            momento_pasta = {i: m for i, _, m, _ in linhas_pasta}
            # Pastas irmãs: a mesma equipe com outro nome no Pós (id_pasta_principal, migration 009)
            irmas = [(principal, i) for i, _, _, principal in linhas_pasta if principal]
            # Excluído não recebe pasta: se voltou, entra como cursista novo.
            # Aguardando é cursista que já recebeu pasta: entra pelo lado do cursista.
            cursor.execute("""
                SELECT id_servo, nome, apelido, status FROM servo
                WHERE status NOT IN ('Excluido', 'Aguardando')
            """)
            servos = cursor.fetchall()
            nome_servo = {i: com_apelido(n, a) for i, n, a, _ in servos}
            status_servo = {i: s for i, _, _, s in servos}

            # Quem foi cursista no ano anterior recebe a primeira pasta e vira servo
            # na virada; "concluido" só aparece se a importação é refeita em janeiro
            cursor.execute("""
                SELECT id_cursista, nome, apelido, id_servo FROM cursista
                WHERE ano = %s AND status IN ('ativo', 'concluido')
            """, (ano - 1,))
            cursistas = cursor.fetchall()
            nome_cursista = {i: com_apelido(n, a) for i, n, a, _ in cursistas}
            aguardando = {i: s for i, _, _, s in cursistas if s}

            # Candidatos pelo nome e pelo apelido: ("s", id_servo) ou ("c", id_cursista)
            def candidatos(linhas, tipo):
                return [((tipo, i), texto) for i, n, a, *_ in linhas for texto in (n, a) if texto]
            ativos = candidatos([s for s in servos if s[3] == "Ativo"], "s") + candidatos(cursistas, "c")
            todos = ativos + candidatos([s for s in servos if s[3] != "Ativo"], "s")
            nome_de = {("s", i): n for i, n in nome_servo.items()} | {("c", i): n for i, n in nome_cursista.items()}

            cursor.execute("SELECT count(*) FROM servo_pasta WHERE ano = %s", (ano,))
            substituidos = cursor.fetchone()[0]

            erros: list[str] = []
            avisos: list[str] = []

            def pessoa(nome: str, funcao: str) -> PessoaImportada:
                # Prefere os servos ativos e os cursistas; só olha os inativos se não achar
                chave, conferir = achar(nome, ativos)
                if chave is None:
                    chave, conferir = achar(nome, todos)
                if chave is None:
                    iguais = sorted({nome_de[i] for i, texto in todos if normalizar(texto) == normalizar(nome)})
                    if len(iguais) > 1:
                        # Não chuta: um cursista deixado de fora aqui sairia do movimento
                        erros.append(f'{funcao}: "{nome}" pode ser {" ou ".join(iguais)}. '
                                     f'Escreva o nome completo na planilha.')
                        return PessoaImportada(nome_planilha=nome, erro="Nome de mais de uma pessoa.")
                    avisos.append(f'{funcao}: "{nome}" não foi encontrado entre os servos e cursistas (ignorado).')
                    return PessoaImportada(nome_planilha=nome)
                tipo, id_ = chave
                if tipo == "c":
                    # O id_servo vem depois, quando o servo Aguardando existir
                    return PessoaImportada(nome_planilha=nome, id_cursista=id_,
                                           servo=nome_cursista[id_], conferir=conferir)
                if status_servo[id_] != "Ativo":
                    avisos.append(f'{funcao}: {nome_servo[id_]} está {status_servo[id_]}.')
                return PessoaImportada(nome_planilha=nome, id_servo=id_,
                                       servo=nome_servo[id_], conferir=conferir)

            resultado: list[PastaImportada] = []
            na_planilha: set[int] = set()
            marcados: set[tuple[int, str]] = set()  # (pasta, momento) com o "X" na planilha
            for lida in lidas:
                id_pasta, conferir = achar(lida.funcao, pastas_sistema)
                if id_pasta:
                    na_planilha.add(id_pasta)
                    marcados |= {(id_pasta, m) for m in MOMENTOS if lida.equipes[m].marcada}
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

            # Cursista com pasta ganha (ou mantém, se a planilha é reimportada) um
            # servo Aguardando, que guarda as pastas até a virada do ano
            cursor.execute("DELETE FROM servo_pasta WHERE ano = %s", (ano,))
            achados = {pe.id_cursista for p in resultado if p.id_pasta for e in p.equipes
                       for pe in e.coordenadores + e.membros if pe.id_cursista}
            servo_do_cursista: dict[int, int] = {}
            for id_cursista in sorted(achados):
                if id_cursista in aguardando:
                    servo_do_cursista[id_cursista] = aguardando[id_cursista]
                    continue
                # Leva os dados; o ano de ingresso é o ano em que foi cursista
                cursor.execute("""
                    INSERT INTO servo (nome, apelido, telefone, email, endereco, data_nascimento,
                                       responsavel_nome, responsavel_telefone, status, ano_ingresso)
                    SELECT nome, apelido, telefone, email, endereco, data_nascimento,
                           responsavel_nome, responsavel_telefone, 'Aguardando', ano
                    FROM cursista WHERE id_cursista = %s
                    RETURNING id_servo
                """, (id_cursista,))
                servo_do_cursista[id_cursista] = cursor.fetchone()[0]
                cursor.execute("UPDATE cursista SET id_servo = %s WHERE id_cursista = %s",
                               (servo_do_cursista[id_cursista], id_cursista))

            # Reimportação: quem perdeu a pasta deixa de ter o servo Aguardando
            desfeitos = [s for c, s in aguardando.items() if c not in achados]
            cursor.execute("UPDATE cursista SET id_servo = NULL WHERE id_servo = ANY(%s)", (desfeitos,))
            cursor.execute("DELETE FROM servo_pasta WHERE id_servo = ANY(%s)", (desfeitos,))
            cursor.execute("DELETE FROM servo WHERE id_servo = ANY(%s) AND status = 'Aguardando'", (desfeitos,))

            for p in resultado:
                for e in p.equipes:
                    for pe in e.coordenadores + e.membros:
                        if pe.id_cursista:
                            pe.id_servo = servo_do_cursista[pe.id_cursista]
            nome_servo |= {servo_do_cursista[c]: nome_cursista[c] for c in achados}

            # Equipe de cada (pasta, momento): [(coordenador, pessoa)]
            equipe_de: dict[tuple[int, str], list[tuple[bool, PessoaImportada]]] = {}
            for p in resultado:
                if p.id_pasta is None:
                    continue
                for e in p.equipes:
                    equipe_de.setdefault((p.id_pasta, e.momento), []).extend(
                        [(True, pe) for pe in e.coordenadores] + [(False, pe) for pe in e.membros])

            # Quem está numa pasta serve nela nos dois momentos em que ela existe: se a
            # planilha marcou o "X" dos dois lados mas trouxe os nomes só de um, o outro
            # recebe as mesmas pessoas. Vale também para as pastas irmãs (nome diferente
            # no Encontro e no Pós), mesmo que a irmã nem esteja na planilha.
            def completar(de: tuple[int, str], para: tuple[int, str]):
                origem = equipe_de.get(de, [])
                if equipe_de.get(para) or not any(pe.id_servo for _, pe in origem):
                    return
                if para[0] in na_planilha and para not in marcados:
                    return
                equipe_de[para] = origem
                (id_de, m_de), (id_para, m_para) = de, para
                avisos.append(f'"{nome_pasta[id_para]}" ({NOME_MOMENTO[m_para]}) estava sem nomes: '
                              f'recebeu a equipe de "{nome_pasta[id_de]}" ({NOME_MOMENTO[m_de]}).')

            for id_pasta, momento in momento_pasta.items():
                if momento == "ambos":
                    completar((id_pasta, "pos"), (id_pasta, "encontro"))
                    completar((id_pasta, "encontro"), (id_pasta, "pos"))
            for id_encontro, id_pos in irmas:
                completar((id_encontro, "encontro"), (id_pos, "pos"))
                completar((id_pos, "pos"), (id_encontro, "encontro"))

            # Lançamentos: (servo, pasta, momento) → coordenador; quem aparece nos dois papéis fica coordenador
            lancamentos: dict[tuple[int, int, str], tuple[bool, list[PessoaImportada]]] = {}
            for (id_pasta, momento), equipe in equipe_de.items():
                for coordenador, pe in equipe:
                    if pe.id_servo is None:
                        continue
                    chave = (pe.id_servo, id_pasta, momento)
                    coord_antes, pessoas = lancamentos.get(chave, (False, []))
                    lancamentos[chave] = (coord_antes or coordenador, pessoas + [pe])

            # Grava de verdade dentro da transação, para o banco conferir as regras
            # (repetição de pasta, Encontro/Pós); na prévia, tudo é desfeito no fim.
            # Os lançamentos antigos do ano já foram apagados lá em cima.

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

            # O que a virada do ano vai fazer (ver resources/virada.py)
            tem_pos = "EXISTS (SELECT 1 FROM servo_pasta sp WHERE sp.id_servo = s.id_servo AND sp.ano = %s AND sp.momento = 'pos')"
            cursor.execute(f"""
                SELECT s.nome, s.apelido FROM servo s WHERE s.status = 'Ativo' AND NOT {tem_pos}
                ORDER BY COALESCE(s.apelido, s.nome), s.nome
            """, (ano,))
            servos_sem_pasta = [com_apelido(n, a) for n, a in cursor.fetchall()]
            cursor.execute(f"""
                SELECT c.nome, c.apelido, COALESCE(s.status = 'Aguardando' AND {tem_pos}, false)
                FROM cursista c LEFT JOIN servo s ON s.id_servo = c.id_servo
                WHERE c.ano = %s AND c.status IN ('ativo', 'concluido')
                ORDER BY COALESCE(c.apelido, c.nome), c.nome
            """, (ano, ano - 1))
            cursistas_do_ano = cursor.fetchall()
            promovidos = [com_apelido(n, a) for n, a, vira in cursistas_do_ano if vira]
            cursistas_sem_pasta = [com_apelido(n, a) for n, a, vira in cursistas_do_ano if not vira]

            cursor.execute("""
                SELECT nome FROM pasta
                WHERE perfil IS NOT NULL
                  AND id_pasta NOT IN (SELECT id_pasta FROM servo_pasta WHERE ano = %s AND momento = 'pos')
                ORDER BY nome
            """, (ano,))
            avisos += [f'A pasta "{n}" ficou sem ninguém no Pós-Encontro.' for (n,) in cursor.fetchall()]

            cursor.execute("SELECT count(*) FROM servo_pasta WHERE ano < %s", (ano - ANOS_GUARDADOS,))
            antigos = cursor.fetchone()[0]

            gravar = confirmar and not erros
            if gravar:
                cursor.execute("DELETE FROM servo_pasta WHERE ano < %s", (ano - ANOS_GUARDADOS,))
                # Pastas do ano em curso valem na hora: a virada roda de novo
                if ano <= ano_atual:
                    aplicar_virada(cursor, ano, forcar=True, registrado_por=getattr(usuario, "id", None))

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
    if not gravar:
        fora_do_historico(request)
    if gravar:
        message = f"{total} lançamento(s) gravado(s) para {ano}."
        if antigos:
            message += f" {antigos} lançamento(s) de antes de {ano - ANOS_GUARDADOS} foram apagados."
    elif confirmar:
        message = f"Nada foi gravado: corrija o(s) {len(erros)} erro(s) e envie de novo."
    else:
        message = f"Prévia de {ano}: {total} lançamento(s), {len(erros)} erro(s), {len(avisos)} aviso(s)."
        if substituidos:
            message += f" Ao confirmar, substitui os {substituidos} lançamento(s) que já existem em {ano}."
        if antigos:
            message += f" Também apaga {antigos} lançamento(s) de antes de {ano - ANOS_GUARDADOS}."

    return PastaImportResponse(
        ano=ano, message=message, gravados=total if gravar else 0, substituidos=substituidos, antigos=antigos,
        pastas=resultado, erros=erros, avisos=avisos,
        promovidos=promovidos, cursistas_sem_pasta=cursistas_sem_pasta, servos_sem_pasta=servos_sem_pasta,
    )
