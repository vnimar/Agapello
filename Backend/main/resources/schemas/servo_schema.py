from pydantic import BaseModel
from typing import Optional, List

class ServoListItem(BaseModel):
    id: int
    nome: str
    telefone: Optional[str] = None
    status: Optional[str] = None
    ano_ingresso: Optional[int] = None
    pastas: list[str]

class ServoDetail(BaseModel):
    id: int
    nome: str
    telefone: Optional[str] = None
    status: Optional[str] = None
    ano_ingresso: Optional[int] = None

# ── Minha conta: o próprio servo ─────────────────────────────────────────────

class MinhaFrequencia(BaseModel):
    presente: int = 0
    justificada: int = 0
    falta: int = 0
    percentual_presenca: Optional[float] = None  # None = nenhuma chamada no ano

class MinhaMissao(BaseModel):
    data: str
    descricao: str
    status: str

class MeuFoguinho(BaseModel):
    sequencia_atual: int = 0
    recorde: int = 0
    chama_acesa: bool = False

class MinhaPasta(BaseModel):
    nome: str
    momento: str          # encontro / pos / ambos
    coordenador: bool = False

class MeuResumo(BaseModel):
    """Frequência do ano, foguinho e pastas de quem está logado."""
    ano: int
    id_servo: Optional[int] = None  # conta sem servo (ex.: admin manual) → resto vazio
    frequencia: MinhaFrequencia = MinhaFrequencia()
    missoes: list[MinhaMissao] = []
    foguinho: MeuFoguinho = MeuFoguinho()
    pastas: list[MinhaPasta] = []
