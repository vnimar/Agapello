from datetime import date, time
from typing import Literal, Optional

from pydantic import BaseModel, Field, field_validator

Publico = Literal["servos", "cursistas", "ambos"]


class MissaoResponse(BaseModel):
    id_missao: int
    data: str
    descricao: str
    local: Optional[str] = "Local não definido"
    horario: Optional[str] = "Horário não definido"
    publico: Publico = "servos"
    conta_frequencia: bool = True
    observacao: Optional[str] = None


class MissaoContaFrequencia(BaseModel):
    """Marca de uma vez quais missões contam (ou não) na frequência."""
    ids_conta: list[int] = []
    ids_nao_conta: list[int] = []


class MissaoCreate(BaseModel):
    data: date
    descricao: str = Field(min_length=1, max_length=200)
    horario: Optional[time] = None
    local: Optional[str] = Field(default=None, max_length=200)
    publico: Publico = "servos"
    conta_frequencia: bool = True
    observacao: Optional[str] = None

    @field_validator("descricao")
    @classmethod
    def descricao_obrigatoria(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("A descrição da missão é obrigatória.")
        return v

    @field_validator("local", "observacao")
    @classmethod
    def limpar_texto(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return None
        v = v.strip()
        return v or None


class MissaoUpdate(MissaoCreate):
    pass


class MissaoImportRequest(BaseModel):
    missoes: list[MissaoCreate] = Field(min_length=1, max_length=200)
    # false → só valida e devolve a prévia; true → grava
    confirmar: bool = False


class MissaoImportItem(BaseModel):
    data: str
    descricao: str
    horario: Optional[str] = None
    local: Optional[str] = None
    publico: Publico
    situacao: Literal["nova", "duplicada"]


class MissaoImportResponse(BaseModel):
    message: str
    gravadas: int
    itens: list[MissaoImportItem]
