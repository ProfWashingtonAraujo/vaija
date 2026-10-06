"""Estado do caixa por restaurante (aberto/fechado).

O cardápio online só aceita pedidos com o caixa aberto. O estado precisa viver no servidor:
guardado no navegador, o cliente (outro navegador) sempre veria o caixa fechado.
"""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import CurrentAuth
from database import get_db
from models import CashRegister, User

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
async def put_cash_register(body: CashRegisterUpdate, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    if auth.role_key not in MANAGER_ROLES:
        return JSONResponse({"ok": False, "error": "forbidden"}, status_code=403)

    user = (await db.execute(
        select(User).where(User.id == auth.user_id, User.tenant_id == auth.tenant_id)
    )).scalar_one_or_none()
    who = user.name if user else "Operador"
    now = datetime.now(timezone.utc)

    row = await db.get(CashRegister, auth.tenant_id)
    if row is None:
        row = CashRegister(tenant_id=auth.tenant_id, is_open=False)
        db.add(row)
    row.is_open = body.isOpen
    if body.isOpen:
        row.opened_at, row.opened_by = now, who
    else:
        row.closed_at, row.closed_by = now, who
    await db.flush()
    return _state(row)


@public_cash_register_router.get("/api/public/{tenant_id}/cash-register")
async def get_public_cash_register(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Só diz se está aberto: o cliente não precisa (nem deve) ver quem abriu ou fechou."""
    row = await db.get(CashRegister, tenant_id)
    return {"isOpen": bool(row and row.is_open)}
