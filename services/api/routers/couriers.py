"""Cadastro de entregadores da loja.

O entregador continua sem login: o link com token (routers/delivery.py) segue sendo o acesso.
O cadastro só padroniza o nome e guarda o WhatsApp para enviar o link direto. A entrega guarda
o nome em texto, então apagar ou renomear um entregador não altera entregas já feitas.
"""
import re

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import CurrentAuth
from database import get_db
from models import Courier

couriers_router = APIRouter(tags=["couriers"])

MANAGER_ROLES = {"admin", "manager"}


class CourierIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    name: str = Field(min_length=1, max_length=60)
    phone: str | None = Field(default=None, max_length=30)
    active: bool = True


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=status)


def _to_dict(courier: Courier) -> dict:
    return {"id": courier.id, "name": courier.name, "phone": courier.phone or "", "active": courier.active}


def _clean_phone(phone: str | None) -> str | None:
    digits = re.sub(r"\D", "", phone or "")
    return digits or None


async def _name_taken(db: AsyncSession, tenant_id: str, name: str, ignore_id: int | None = None) -> bool:
    query = select(Courier.id).where(Courier.tenant_id == tenant_id, func.lower(Courier.name) == name.lower())
    if ignore_id is not None:
        query = query.where(Courier.id != ignore_id)
    return (await db.execute(query)).first() is not None


@couriers_router.get("/api/couriers")
async def list_couriers(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    """Qualquer usuário da loja lê a lista (quem despacha o pedido escolhe o entregador); só gerente altera."""
    rows = (await db.execute(
        select(Courier).where(Courier.tenant_id == auth.tenant_id).order_by(func.lower(Courier.name))
    )).scalars().all()
    return {"couriers": [_to_dict(row) for row in rows]}


@couriers_router.post("/api/couriers")
async def create_courier(body: CourierIn, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    name = body.name.strip()
    if not name:
        return _error(400, "invalid_name")
    if await _name_taken(db, auth.tenant_id, name):
        return _error(409, "name_taken")
    courier = Courier(tenant_id=auth.tenant_id, name=name, phone=_clean_phone(body.phone), active=body.active)
    db.add(courier)
    await db.flush()
    return {"ok": True, "courier": _to_dict(courier)}


@couriers_router.put("/api/couriers/{courier_id}")
async def update_courier(courier_id: int, body: CourierIn, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    courier = await db.get(Courier, courier_id)
    if courier is None or courier.tenant_id != auth.tenant_id:
        return _error(404, "courier_not_found")
    name = body.name.strip()
    if not name:
        return _error(400, "invalid_name")
    if await _name_taken(db, auth.tenant_id, name, ignore_id=courier.id):
        return _error(409, "name_taken")
    courier.name = name
    courier.phone = _clean_phone(body.phone)
    courier.active = body.active
    await db.flush()
    return {"ok": True, "courier": _to_dict(courier)}


@couriers_router.delete("/api/couriers/{courier_id}")
async def delete_courier(courier_id: int, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    courier = await db.get(Courier, courier_id)
    if courier is None or courier.tenant_id != auth.tenant_id:
        return _error(404, "courier_not_found")
    await db.delete(courier)
    await db.flush()
    return {"ok": True}
