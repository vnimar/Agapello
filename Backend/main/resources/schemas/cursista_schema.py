from typing import Optional
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
