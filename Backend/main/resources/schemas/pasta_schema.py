from typing import Literal, Optional

from pydantic import BaseModel

MomentoType = Literal["encontro", "pos"]


class PessoaImportada(BaseModel):
    nome_planilha: str
    id_servo: Optional[int] = None
    id_cursista: Optional[int] = None  # cursista do ano anterior: vira servo na virada do ano
    servo: Optional[str] = None      # nome no sistema
    conferir: bool = False           # achado por aproximação: vale olhar
    erro: Optional[str] = None       # recusado pelo banco (ex.: repetição de pasta)


class EquipeImportada(BaseModel):
    momento: MomentoType
    coordenadores: list[PessoaImportada]
    membros: list[PessoaImportada]
    ignorados: list[str]             # Apostolado, Missionária Jovem, "Xxx e Xxx"


class PastaImportada(BaseModel):
    funcao_planilha: str
    linha: int
    id_pasta: Optional[int] = None
    pasta: Optional[str] = None      # nome no sistema; None = não existe no sistema
    conferir: bool = False
    equipes: list[EquipeImportada]


class PastaImportResponse(BaseModel):
    ano: int
    message: str
    gravados: int
    substituidos: int                # lançamentos do ano que já existiam
    antigos: int = 0                 # lançamentos de mais de 2 anos antes, apagados ao gravar
    pastas: list[PastaImportada]
    erros: list[str]                 # impedem gravar
    avisos: list[str]                # só para conferir
    # O que a virada do ano faz (1º de janeiro, ou na hora se o ano já começou)
    promovidos: list[str] = []           # cursistas que viram servos
    cursistas_sem_pasta: list[str] = []  # deixam o movimento
    servos_sem_pasta: list[str] = []     # ficam inativos
