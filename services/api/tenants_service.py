"""Cliente (tenant) do Vaija: dados e plano vêm do servidor, nunca do navegador."""
import re
import unicodedata

from sqlalchemy.ext.asyncio import AsyncSession

from models import Tenant

PLANS = ("Free", "Start", "Pro", "Premium")
PLATFORM_TENANT_ID = "admin"
RESERVED_TENANT_IDS = {PLATFORM_TENANT_ID}


def slugify(value: str) -> str:
    text = unicodedata.normalize("NFD", value).encode("ascii", "ignore").decode("ascii").lower()
    return re.sub(r"[^a-z0-9]+", "-", text).strip("-")[:40]


def tenant_to_dict(tenant: Tenant) -> dict:
    return {
        "id": tenant.id,
        "restaurantName": tenant.restaurant_name,
        "ownerName": tenant.owner_name,
        "email": tenant.email,
        "phone": tenant.phone,
        "city": tenant.city,
        "businessType": tenant.business_type,
        "plan": tenant.plan,
        "status": tenant.status,
        "createdAt": tenant.created_at.isoformat() if tenant.created_at else None,
    }


def fallback_tenant_dict(tenant_id: str) -> dict:
    """Loja que já tinha acesso antes do cadastro de clientes existir no servidor.

    Segue liberada (Premium) até o dono do SaaS registrá-la; assim ninguém perde acesso na migração.
    """
    if tenant_id == PLATFORM_TENANT_ID:
        return {
            "id": tenant_id, "restaurantName": "Vaija Administração SaaS", "ownerName": "", "email": "", "phone": "",
            "city": "", "businessType": "restaurant", "plan": "Premium", "status": "active", "createdAt": None,
        }
    return {
        "id": tenant_id, "restaurantName": tenant_id, "ownerName": "", "email": "", "phone": "", "city": "",
        "businessType": "pizzeria", "plan": "Premium", "status": "active", "createdAt": None,
    }


async def tenant_payload(db: AsyncSession, tenant_id: str) -> dict:
    tenant = await db.get(Tenant, tenant_id)
    return tenant_to_dict(tenant) if tenant else fallback_tenant_dict(tenant_id)


async def unique_tenant_id(db: AsyncSession, restaurant_name: str) -> str:
    base = slugify(restaurant_name) or "cliente"
    if base in RESERVED_TENANT_IDS or base == "default":
        base = f"{base}-cliente"
    candidate, suffix = base, 2
    while await db.get(Tenant, candidate) is not None:
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate
