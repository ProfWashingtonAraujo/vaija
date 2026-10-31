"""Configurações do restaurante, guardadas por tenant.

O painel lê e grava tudo; o link público do cliente só enxerga o que ele precisa (nome, telefone, logo
e regras de entrega), nunca preferências internas, horários ou plano.
"""
import base64
import json
import re
from urllib.parse import quote

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse, RedirectResponse, Response
from pydantic import BaseModel, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from auth import CurrentAuth
from database import get_db
from models import RestaurantSettings, Tenant

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
    if row:
        return {"settings": row.data}
    # Loja ainda sem configurações: parte do cadastro dela, nunca de nome e telefone de exemplo.
    tenant = await db.get(Tenant, auth.tenant_id)
    if tenant:
        return {"settings": {"restaurant": {"name": tenant.restaurant_name, "phone": tenant.phone}}}
    return {"settings": None}


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
    if not restaurant and (tenant := await db.get(Tenant, tenant_id)):
        restaurant = {"name": tenant.restaurant_name, "phone": tenant.phone}
    delivery = data.get("delivery") or {}
    public: dict = {}
    if restaurant:
        public["restaurant"] = {key: restaurant[key] for key in ("name", "phone", "logo", "brandColor") if restaurant.get(key)}
    if delivery:
        public["delivery"] = {key: delivery[key] for key in ("mode", "fixedFee", "feePerKm", "freeKm", "originCep") if key in delivery}
    payments = data.get("payments") or {}
    if payments:
        public["payments"] = {key: payments[key] for key in ("pix", "card", "cash", "pixKeyType", "pixKey", "pixName", "pixCity") if key in payments}
    return public


_DATA_URL = re.compile(r"^data:(image/(?:png|jpeg|webp));base64,(.+)$", re.DOTALL)
_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")


async def _public_restaurant(db: AsyncSession, tenant_id: str) -> dict:
    row = await db.get(RestaurantSettings, tenant_id)
    return ((row.data if row else {}) or {}).get("restaurant") or {}


@public_settings_router.get("/api/public/{tenant_id}/manifest.webmanifest")
async def get_public_manifest(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Manifesto do app instalável do cliente final: abre direto no cardápio da loja, não na landing page.

    Precisa ser uma URL de verdade (não blob:), senão o Chrome do Android ignora a troca e instala com o
    manifesto padrão da Vaija.
    """
    restaurant = await _public_restaurant(db, tenant_id)
    name = str(restaurant.get("name") or "Pedidos")
    color = restaurant.get("brandColor")
    tenant = await db.get(Tenant, tenant_id)
    public_id = (tenant.slug if tenant and tenant.slug else tenant_id)
    start_url = "/pedido" if public_id == "default" else f"/pedido/{quote(public_id, safe='')}"
    logo = _DATA_URL.match(str(restaurant.get("logo") or ""))
    icons = (
        [{"src": f"/api/public/{quote(tenant_id, safe='')}/icon", "sizes": "512x512", "type": logo.group(1), "purpose": "any"}]
        if logo else
        [
            {"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
            {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
        ]
    )
    manifest = {
        "name": name, "short_name": name[:12], "start_url": start_url, "scope": start_url, "display": "standalone",
        "orientation": "portrait", "background_color": "#ffffff",
        "theme_color": color if isinstance(color, str) and _HEX_COLOR.match(color) else "#ff6b00",
        "icons": icons,
    }
    return Response(json.dumps(manifest), media_type="application/manifest+json", headers={"Cache-Control": "public, max-age=300"})


@public_settings_router.get("/api/public/{tenant_id}/icon")
async def get_public_icon(tenant_id: str, db: AsyncSession = Depends(get_db)):
    """Logo da loja como imagem de verdade (a logo é guardada como data URL nas configurações)."""
    logo = _DATA_URL.match(str((await _public_restaurant(db, tenant_id)).get("logo") or ""))
    if not logo:
        return RedirectResponse("/icon-512.png", status_code=302)
    try:
        content = base64.b64decode(logo.group(2))
    except ValueError:
        return RedirectResponse("/icon-512.png", status_code=302)
    return Response(content, media_type=logo.group(1), headers={"Cache-Control": "public, max-age=300"})
