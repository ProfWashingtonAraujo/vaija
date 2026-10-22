"""Estado do caixa por restaurante (aberto/fechado).

O cardápio online só aceita pedidos com o caixa aberto. O estado precisa viver no servidor:
guardado no navegador, o cliente (outro navegador) sempre veria o caixa fechado.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from auth import CurrentAuth
from database import get_db
from models import CashRegister

cash_register_router = APIRouter(tags=["cash-register"])
public_cash_register_router = APIRouter(tags=["public"])

MANAGER_ROLES = {"admin", "manager"}


class CashRegisterUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    isOpen: bool


def _iso(value: datetime | None) -> str | None:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z") if value else None


def _state(row: CashRegister | None) -> dict:
    if row is None:
        return {"isOpen": False}
    state = {
        "isOpen": row.is_open,
        "openedAt": _iso(row.opened_at),
        "openedBy": row.opened_by,
        "closedAt": _iso(row.closed_at),
        "closedBy": row.closed_by,
    }
    return {key: value for key, value in state.items() if value is not None}


@cash_register_router.get("/api/cash-register")
async def get_cash_register(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    row = await db.get(CashRegister, auth.tenant_id)
    return _state(row)


@cash_register_router.put("/api/cash-register")
async def put_cash_register(body: CashRegisterUpdate, auth: CurrentAuth):
    """Antigo interruptor aberto/fechado. Abrir e fechar agora passam por /api/cash/open e /api/cash/close
    (fundo de troco e dinheiro contado); uma tela antiga que ainda chame isto recebe o motivo."""
    if auth.role_key not in MANAGER_ROLES:
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)
    return JSONResponse({"ok": False, "error": "use_cash_open" if body.isOpen else "use_cash_close"}, status_code=409)


@public_cash_register_router.get("/api/public/{tenant_id}/cash-register")
async def get_public_cash_register(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Só diz se está aberto: o cliente não precisa (nem deve) ver quem abriu ou fechou."""
    row = await db.get(CashRegister, tenant_id)
    return {"isOpen": bool(row and row.is_open)}
