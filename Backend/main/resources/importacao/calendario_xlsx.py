"""
Leitura da planilha do calendário do ano (.xlsx), no formato do "Modelo - Calendário".

Uma linha por missão, com cabeçalho. As colunas são achadas pelo nome, em
qualquer ordem; só Data e Missão são obrigatórias:
    Data | Missão | Horário | Local | Público | Conta frequência? | Observação
Lê a aba "Calendário" (ou a primeira, se não houver). Aqui só se lê a planilha;
quem confere duplicadas e nomes parecidos é o router.
"""
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime, time
from typing import Optional

from openpyxl import load_workbook

from .cursistas_xlsx import _data, _texto
from .pastas_xlsx import PlanilhaInvalida, normalizar

_CABECALHOS = {
    "data": ("data", "dia"),
    "descricao": ("missao", "descricao", "evento"),
    "horario": ("horario", "hora"),
    "local": ("local",),
    "publico": ("publico",),
    "conta_frequencia": ("conta frequencia", "conta na frequencia", "frequencia"),
    "observacao": ("observacao", "obs"),
}
_PUBLICOS = {"servos": "servos", "servo": "servos", "cursistas": "cursistas", "cursista": "cursistas",
             "ambos": "ambos", "todos": "ambos", "servos e cursistas": "ambos"}
_SIM = {"sim", "s", "x", "conta", "true", "1"}
_NAO = {"nao", "n", "nao conta", "false", "0"}
_LOCAL_INDEFINIDO = {"a definir", "a def", "definir", "indefinido", "nao definido"}


@dataclass
class MissaoLida:
    linha: int
    descricao: str
    data: Optional[date] = None
    horario: Optional[time] = None
    local: Optional[str] = None
    publico: str = "servos"
    conta_frequencia: bool = True
    observacao: Optional[str] = None
    erro: Optional[str] = None
    avisos: list[str] = field(default_factory=list)


def _data_missao(valor) -> date:
    """Como a data de nascimento, mas ano com 2 dígitos é sempre 20xx (27 → 2027)."""
    texto = _texto(valor)
    achado = re.fullmatch(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{2})", texto)
    if achado:
        d, m, a = (int(x) for x in achado.groups())
        return date(2000 + a, m, d)
    return _data(valor)


def _horario(valor) -> Optional[time]:
    """Aceita hora do Excel ou texto 17:00, 17h, 17h30, 7:00."""
    if isinstance(valor, datetime):
        return valor.time().replace(second=0, microsecond=0)
    if isinstance(valor, time):
        return valor.replace(second=0, microsecond=0)
    if isinstance(valor, float) and 0 <= valor < 1:  # fração do dia
        minutos = round(valor * 24 * 60)
        return time(minutos // 60, minutos % 60)
    texto = _texto(valor).lower().replace(" ", "")
    if not texto:
        return None
    achado = re.fullmatch(r"(\d{1,2})(?:[:h](\d{2})?)?(?:min)?", texto)
    if not achado:
        raise ValueError
    h, m = int(achado.group(1)), int(achado.group(2) or 0)
    return time(h, m)  # ValueError se fora do intervalo


def _achar_cabecalho(linhas: list[tuple]) -> tuple[int, dict[str, int]]:
    """Primeira linha (entre as 10 primeiras) que tenha Data e Missão."""
    for i, valores in enumerate(linhas[:10]):
        colunas: dict[str, int] = {}
        for c, valor in enumerate(valores):
            titulo = normalizar(_texto(valor))
            for campo, inicios in _CABECALHOS.items():
                if campo not in colunas and any(titulo.startswith(x) for x in inicios):
                    colunas[campo] = c
                    break
        if "data" in colunas and "descricao" in colunas:
            return i, colunas
    raise PlanilhaInvalida('Não achei o cabeçalho: a planilha precisa das colunas "Data" e "Missão".')


def ler_planilha(conteudo: bytes) -> list[MissaoLida]:
    try:
        wb = load_workbook(io.BytesIO(conteudo), data_only=True, read_only=True)
    except Exception:
        raise PlanilhaInvalida("Não consegui abrir o arquivo. Envie a planilha em .xlsx.")

    aba = next((ws for ws in wb.worksheets if normalizar(ws.title) == "calendario"), wb.worksheets[0])
    linhas = [tuple(r) for r in aba.iter_rows(values_only=True)]
    inicio, colunas = _achar_cabecalho(linhas)

    def valor(r: tuple, campo: str):
        c = colunas.get(campo)
        return r[c] if c is not None and c < len(r) else None

    lidas: list[MissaoLida] = []
    for i, r in enumerate(linhas[inicio + 1:], start=inicio + 2):
        bruto_data = valor(r, "data")
        descricao = _texto(valor(r, "descricao"))
        if not _texto(bruto_data) and not descricao:
            continue  # linha vazia
        lida = MissaoLida(linha=i, descricao=descricao)

        if not _texto(bruto_data):
            lida.erro = "sem data"
        else:
            try:
                lida.data = _data_missao(bruto_data)
            except ValueError:
                lida.erro = f'data "{_texto(bruto_data)}" inválida (use DD/MM/AAAA)'
        if not lida.erro and not descricao:
            lida.erro = "sem o nome da missão"
        if not lida.erro and len(descricao) > 200:
            lida.erro = "nome da missão grande demais (máximo 200 letras)"

        bruto_hora = valor(r, "horario")
        if _texto(bruto_hora):
            try:
                lida.horario = _horario(bruto_hora)
            except ValueError:
                lida.avisos.append(f'horário "{_texto(bruto_hora)}" não entendido (fica sem horário)')

        local = _texto(valor(r, "local"))
        lida.local = local[:200] if local and normalizar(local) not in _LOCAL_INDEFINIDO else None

        publico = normalizar(_texto(valor(r, "publico")))
        if publico:
            if publico in _PUBLICOS:
                lida.publico = _PUBLICOS[publico]
            else:
                lida.avisos.append(f'público "{_texto(valor(r, "publico"))}" não entendido (fica Servos)')

        conta = normalizar(_texto(valor(r, "conta_frequencia")))
        if conta in _NAO:
            lida.conta_frequencia = False
        elif conta and conta not in _SIM:
            lida.avisos.append(f'"Conta frequência?" = "{_texto(valor(r, "conta_frequencia"))}" '
                               'não entendido (fica Sim)')

        lida.observacao = _texto(valor(r, "observacao")) or None
        lidas.append(lida)

    if not lidas:
        raise PlanilhaInvalida("A planilha não tem nenhuma missão abaixo do cabeçalho.")
    return lidas
