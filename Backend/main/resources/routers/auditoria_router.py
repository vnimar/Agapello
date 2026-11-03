import logging
from datetime import datetime
from typing import Optional

import psycopg2.extras
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from ..bd.db import get_connection
from ..config.security import require_admin

logger = logging.getLogger(__name__)

# Histórico de alterações (tabela auditoria, migration 017): só o administrador
router = APIRouter(prefix="/auditoria", tags=["Auditoria"], dependencies=[Depends(require_admin)])


class RegistroAuditoria(BaseModel):
    id_auditoria: int
    criado_em: datetime
    usuario: Optional[str] = None  # None = sem login
    metodo: str
    rota: str
    status: int
    corpo: Optional[str] = None


@router.get("/", response_model=list[RegistroAuditoria])
@router.get("", response_model=list[RegistroAuditoria], include_in_schema=False)
def listar_auditoria(
    busca: Optional[str] = None,
    antes_de: Optional[int] = Query(None, description="id_auditoria do último item da página anterior"),
    limite: int = Query(50, ge=1, le=200),
):
    """Mais recentes primeiro. busca procura em quem fez, na rota e no corpo."""
    filtros, params = [], []
    if busca and busca.strip():
        filtros.append("(usuario ILIKE %s OR rota ILIKE %s OR corpo ILIKE %s)")
        params += [f"%{busca.strip()}%"] * 3
    if antes_de:
        filtros.append("id_auditoria < %s")
        params.append(antes_de)
    onde = f"WHERE {' AND '.join(filtros)}" if filtros else ""

    try:
        with get_connection() as conn, conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cursor:
            cursor.execute(f"""
                SELECT id_auditoria, criado_em, usuario, metodo, rota, status, corpo
                FROM auditoria {onde}
                ORDER BY id_auditoria DESC
                LIMIT %s
            """, (*params, limite))
            return cursor.fetchall()
    except Exception as e:
        logger.error(f"Erro ao listar auditoria: {e}")
        raise HTTPException(status_code=500, detail="Erro interno.")
