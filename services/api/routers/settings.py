"""Configurações do restaurante, guardadas por tenant.

O painel lê e grava tudo; o link público do cliente só enxerga o que ele precisa (nome, telefone, logo
e regras de entrega), nunca preferências internas, horários ou plano.
"""
import json

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from auth import CurrentAuth
from database import get_db
from models import RestaurantSettings

settings_router = APIRouter(tags=["settings"])
public_settings_router = APIRouter(tags=["public"])

MANAGER_ROLES = {"admin", "manager"}
MAX_SETTINGS_BYTES = 3_000_000  # a logo vem embutida (data URL)
DELIVERY_MODES = {"fixed", "perKm"}


class SettingsPayload(BaseModel):
    model_config = ConfigDict(extra="ignore")

    settings: dict


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=status)


def _is_valid(settings: dict) -> bool:
    if len(json.dumps(settings)) > MAX_SETTINGS_BYTES:
        return False
    delivery = settings.get("delivery")
    if delivery is not None and (not isinstance(delivery, dict) or delivery.get("mode") not in DELIVERY_MODES):
        return False
    restaurant = settings.get("restaurant")
    return restaurant is None or isinstance(restaurant, dict)


@settings_router.get("/api/settings")
async def read_settings(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    row = await db.get(RestaurantSettings, auth.tenant_id)
    return {"settings": row.data if row else None}


@settings_router.put("/api/settings")
async def write_settings(body: SettingsPayload, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    if not _is_valid(body.settings):
        return _error(400, "invalid_settings")

    row = await db.get(RestaurantSettings, auth.tenant_id)
    if row is None:
        db.add(RestaurantSettings(tenant_id=auth.tenant_id, data=body.settings))
    else:
        row.data = body.settings
    await db.flush()
    return {"ok": True, "settings": body.settings}


@public_settings_router.get("/api/public/{tenant_id}/settings")
async def get_public_settings(tenant_id: str, db: AsyncSession = Depends(get_db)):
    row = await db.get(RestaurantSettings, tenant_id)
    data = row.data if row else {}
    restaurant = data.get("restaurant") or {}
    delivery = data.get("delivery") or {}
    public: dict = {}
    if restaurant:
        public["restaurant"] = {key: restaurant[key] for key in ("name", "phone", "logo") if restaurant.get(key)}
    if delivery:
        public["delivery"] = {key: delivery[key] for key in ("mode", "fixedFee", "feePerKm", "originCep") if key in delivery}
    return public
