from datetime import date
from typing import Literal, Optional
from pydantic import BaseModel, Field

from .frequencia_schema import StatusFrequencia


# ── Requests ──────────────────────────────────────────────────────────────────

class ChamadaCursistaItem(BaseModel):
    id_cursista: int
    status: StatusFrequencia


class ChamadaCursistaRequest(BaseModel):
    itens: list[ChamadaCursistaItem] = Field(min_length=1)


# ── Responses ─────────────────────────────────────────────────────────────────

class MissaoCursista(BaseModel):
    id_missao: int
    data: str
    descricao: str
    tem_frequencia: bool  # já tem chamada em alguma comunidade de quem pergunta


class MissoesCursistaResponse(BaseModel):
    data: list[MissaoCursista]


class CursistaChamada(BaseModel):
    id_cursista: int
    nome: str
    status: Optional[StatusFrequencia] = None  # None = chamada ainda não feita


class ComunidadeChamada(BaseModel):
    id_comunidade: int
    nome: str
    cursistas: list[CursistaChamada]


class ChamadaCursistaResponse(BaseModel):
    id_missao: int
    data: str
    descricao: str
    comunidades: list[ComunidadeChamada]


# ── Frequência do ano (lista com %) ──────────────────────────────────────────

class CursistaFrequencia(BaseModel):
    id_cursista: int
    nome: str
    presente: int = 0
    justificada: int = 0
    falta: int = 0
    percentual_presenca: Optional[float] = None  # None = nenhuma chamada no ano


class ComunidadeFrequencia(BaseModel):
    id_comunidade: int
    nome: str
    cursistas: list[CursistaFrequencia]


class FrequenciaCursistasResponse(BaseModel):
    ano: int
    comunidades: list[ComunidadeFrequencia]


# ── Gestão (admin e coord. geral) ────────────────────────────────────────────

class CursistaImportado(BaseModel):
    linha: int
    nome: str
    comunidade: Optional[str] = None  # nome no sistema; None = não achou
    acao: Literal["novo", "atualiza", "erro"]
    erro: Optional[str] = None
    avisos: list[str] = []


class ImportacaoCursistasResponse(BaseModel):
    ano: int
    message: str
    gravado: bool
    novos: int
    atualizados: int
    cursistas: list[CursistaImportado]
    erros: list[str]   # impedem gravar
    avisos: list[str]  # só para conferir


class CursistaItem(BaseModel):
    id_cursista: int
    nome: str
    id_comunidade: Optional[int] = None
    comunidade: Optional[str] = None
    status: str
    telefone: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    data_nascimento: Optional[date] = None
    idade: Optional[int] = None


class FaltosoEncontro(BaseModel):
    id_cursista: int
    nome: str
    comunidade: Optional[str] = None
    faltas: list[date]  # dias do encontro com Falta ou Justificada


class ExcluirCursistas(BaseModel):
    ids: list[int] = Field(min_length=1)
