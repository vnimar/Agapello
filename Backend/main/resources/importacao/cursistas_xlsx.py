"""
Leitura da planilha de cursistas do encontro (.xlsx).

Uma linha por cursista, com cabeçalho. As colunas são achadas pelo nome, em
qualquer ordem; só Nome e Comunidade são obrigatórias:
    Nome | Comunidade | Email | Telefone | Endereço | Data de nascimento
Colunas que não forem reconhecidas são ignoradas.
Aqui só se lê a planilha; quem confere comunidades e repetidos é o router.
"""
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional

from openpyxl import load_workbook

from .pastas_xlsx import PlanilhaInvalida, normalizar

# Campo → como o cabeçalho pode começar (já normalizado)
_CABECALHOS = {
    "nome": ("nome",),
    "comunidade": ("comunidade",),
    "email": ("email", "e mail"),
    "telefone": ("telefone", "celular", "whatsapp", "contato"),
    "endereco": ("endereco",),
    "nascimento": ("data de nascimento", "nascimento", "data nascimento", "data de nasc", "dt nasc"),
}
_EMAIL = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


@dataclass
class CursistaLido:
    linha: int
    nome: str
    comunidade: str
    email: Optional[str] = None
    telefone: Optional[str] = None
    endereco: Optional[str] = None
    nascimento: Optional[date] = None
    avisos: list[str] = field(default_factory=list)  # campos ignorados por estarem inválidos


def _texto(valor) -> str:
    if valor is None:
        return ""
    if isinstance(valor, float) and valor.is_integer():
        valor = int(valor)  # telefone digitado como número
    return " ".join(str(valor).split())


def _data(valor) -> Optional[date]:
    """Aceita data do Excel ou texto DD/MM/AAAA (também com - ou .)."""
    if isinstance(valor, datetime):
        return valor.date()
    if isinstance(valor, date):
        return valor
    achado = re.fullmatch(r"(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})", _texto(valor))
    if not achado:
        raise ValueError
    d, m, a = (int(x) for x in achado.groups())
    if a < 100:  # 95 → 1995, 05 → 2005
        a += 1900 if a > date.today().year % 100 else 2000
    return date(a, m, d)


def _achar_cabecalho(linhas: list[tuple]) -> tuple[int, dict[str, int]]:
    """Primeira linha (entre as 10 primeiras) que tenha Nome e Comunidade."""
    for i, valores in enumerate(linhas[:10]):
        colunas: dict[str, int] = {}
        for c, valor in enumerate(valores):
            titulo = normalizar(_texto(valor))
            for campo, inicios in _CABECALHOS.items():
                if campo not in colunas and any(titulo.startswith(x) for x in inicios):
                    colunas[campo] = c
                    break
        if "nome" in colunas and "comunidade" in colunas:
            return i, colunas
    raise PlanilhaInvalida('Não achei o cabeçalho: a planilha precisa das colunas "Nome" e "Comunidade".')


def ler_planilha(conteudo: bytes) -> list[CursistaLido]:
    try:
        wb = load_workbook(io.BytesIO(conteudo), data_only=True, read_only=True)
    except Exception:
        raise PlanilhaInvalida("Não consegui abrir o arquivo. Envie a planilha em .xlsx.")

    linhas = [tuple(r) for r in wb.worksheets[0].iter_rows(values_only=True)]
    inicio, colunas = _achar_cabecalho(linhas)

    def valor(r: tuple, campo: str):
        c = colunas.get(campo)
        return r[c] if c is not None and c < len(r) else None

    lidos: list[CursistaLido] = []
    for i, r in enumerate(linhas[inicio + 1:], start=inicio + 2):
        nome = _texto(valor(r, "nome"))
        comunidade = _texto(valor(r, "comunidade"))
        if not nome and not comunidade:
            continue  # linha vazia
        lido = CursistaLido(linha=i, nome=nome, comunidade=comunidade)

        email = _texto(valor(r, "email")).lower()
        if email and not _EMAIL.match(email):
            lido.avisos.append(f'email "{email}" inválido (ignorado)')
        else:
            lido.email = email or None

        lido.telefone = _texto(valor(r, "telefone")) or None
        lido.endereco = _texto(valor(r, "endereco")) or None

        bruto = valor(r, "nascimento")
        if _texto(bruto):
            try:
                nascimento = _data(bruto)
                if not (date(1900, 1, 2) <= nascimento <= date.today()):
                    raise ValueError
                lido.nascimento = nascimento
            except ValueError:
                lido.avisos.append(f'data de nascimento "{_texto(bruto)}" inválida (ignorada)')

        lidos.append(lido)

    if not lidos:
        raise PlanilhaInvalida("A planilha não tem nenhum cursista abaixo do cabeçalho.")
    return lidos
