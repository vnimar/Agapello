from datetime import date
from pydantic import BaseModel, field_validator
from typing import Optional, List, Literal

class ServoListItem(BaseModel):
    id: int
    nome: str
    telefone: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    data_nascimento: Optional[date] = None
    idade: Optional[int] = None  # calculada pelo banco (fn_idade), nunca guardada
    status: Optional[str] = None
    ano_ingresso: Optional[int] = None
    data_saida: Optional[date] = None  # só de quem está inativo
    pastas: list[str]

class ServoDetail(BaseModel):
    id: int
    nome: str
    telefone: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    data_nascimento: Optional[date] = None
    idade: Optional[int] = None
    status: Optional[str] = None
    ano_ingresso: Optional[int] = None

class ServoDadosUpdate(BaseModel):
    """Dados de contato: o próprio servo ou admin/coord. geral. Vazio apaga o campo."""
    telefone: Optional[str] = None
    email: Optional[str] = None
    endereco: Optional[str] = None
    data_nascimento: Optional[date] = None

    @field_validator("telefone", "email", "endereco")
    @classmethod
    def limpar(cls, valor: Optional[str]) -> Optional[str]:
        valor = (valor or "").strip()
        return valor or None

    @field_validator("email")
    @classmethod
    def validar_email(cls, valor: Optional[str]) -> Optional[str]:
        if valor and ("@" not in valor or "." not in valor.split("@")[-1] or " " in valor):
            raise ValueError("Email inválido.")
        return valor.lower() if valor else None

    @field_validator("data_nascimento")
    @classmethod
    def validar_nascimento(cls, valor: Optional[date]) -> Optional[date]:
        if valor and not (date(1900, 1, 2) <= valor <= date.today()):
            raise ValueError("Data de nascimento inválida.")
        return valor

class ServoStatusUpdate(BaseModel):
    """Inativar (com motivo opcional) ou reativar um servo."""
    status: Literal["Ativo", "Inativo"]
    motivo: Optional[str] = None
    # Reativar quem saiu há mais de 2 anos só como exceção confirmada
    excecao: bool = False

# ── Revisão anual de inativos ────────────────────────────────────────────────

class InativoParaRevisao(BaseModel):
    id: int
    nome: str
    data_saida: date
    tem_login: bool

class ExcluirServos(BaseModel):
    ids: list[int]

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
