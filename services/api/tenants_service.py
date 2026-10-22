"""Cliente (tenant) do Vaija: dados e plano vêm do servidor, nunca do navegador."""
import re
import unicodedata

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import Tenant

PLANS = ("Free", "Start", "Pro", "Premium")
PLATFORM_TENANT_ID = "admin"
RESERVED_TENANT_IDS = {PLATFORM_TENANT_ID}

# Endereços que não podem virar slug: confundiriam rotas do site e da API.
RESERVED_SLUGS = {
    "default", "admin", "saas", "api", "login", "pedido", "checkout", "acompanhar", "entregador", "plans", "leads",
    "vaija", "painel", "dashboard", "suporte", "support", "assinatura", "planos", "app", "www",
}
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


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
        "slug": tenant.slug,
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
            "city": "", "businessType": "restaurant", "slug": None, "plan": "Premium", "status": "active", "createdAt": None,
        }
    return {
        "id": tenant_id, "restaurantName": tenant_id, "ownerName": "", "email": "", "phone": "", "city": "",
        "businessType": "pizzeria", "slug": None, "plan": "Premium", "status": "active", "createdAt": None,
    }


async def tenant_payload(db: AsyncSession, tenant_id: str) -> dict:
    tenant = await db.get(Tenant, tenant_id)
    return tenant_to_dict(tenant) if tenant else fallback_tenant_dict(tenant_id)


async def unique_tenant_id(db: AsyncSession, restaurant_name: str) -> str:
    base = slugify(restaurant_name) or "cliente"
    if base in RESERVED_TENANT_IDS or base == "default":
        base = f"{base}-cliente"
    candidate, suffix = base, 2
    # o id novo também não pode coincidir com o endereço amigável de outra loja
    while await db.get(Tenant, candidate) is not None or await _slug_in_use(db, candidate):
        candidate = f"{base}-{suffix}"
        suffix += 1
    return candidate


async def _slug_in_use(db: AsyncSession, slug: str) -> bool:
    return (await db.execute(select(Tenant.id).where(Tenant.slug == slug))).first() is not None


async def slug_error(db: AsyncSession, tenant_id: str, slug: str) -> str | None:
    """Código do erro se o endereço não puder ser usado por essa loja; None se estiver livre."""
    if len(slug) < 3 or len(slug) > 40 or not SLUG_PATTERN.match(slug):
        return "invalid_slug"
    if slug in RESERVED_SLUGS or slug in RESERVED_TENANT_IDS:
        return "reserved_slug"
    other_id = await db.get(Tenant, slug)
    if other_id is not None and other_id.id != tenant_id:
        return "slug_taken"
    owner = (await db.execute(select(Tenant.id).where(Tenant.slug == slug))).scalar_one_or_none()
    if owner is not None and owner != tenant_id:
        return "slug_taken"
    return None
