"""Painel do dono do SaaS: clientes, leads da página de vendas e auditoria. Tudo guardado no servidor."""
import logging
import time
from collections import defaultdict, deque
from typing import Literal

from fastapi import APIRouter, Depends, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.exc import IntegrityError
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

import asaas
from auth import CurrentAuth, PlatformAdmin, hash_password, new_session, set_auth_cookies
from database import get_db
from models import AuditLog, Category, Lead, PlanConfig, Subscription, Tenant, User
from plans_service import PLAN_KEYS, load_plans
from tenants_service import (
    PLANS, PLATFORM_TENANT_ID, RESERVED_TENANT_IDS, slug_error, tenant_payload, tenant_to_dict, unique_tenant_id,
)
from slug_resolver import invalidate_slug_cache
from user_utils import BUSINESS_CATEGORIES, is_unique_violation, is_valid_username, normalize_username
from .auth import _to_user_out
from .billing import sync_subscription_plan

logger = logging.getLogger(__name__)

saas_router = APIRouter(prefix="/api/platform", tags=["saas"])
tenant_router = APIRouter(prefix="/api/tenant", tags=["tenant"])
public_leads_router = APIRouter(prefix="/api/public", tags=["leads"])

Plan = Literal["Free", "Start", "Pro", "Premium"]
TenantStatus = Literal["active", "inactive"]
LeadStatus = Literal["Novo", "Contatado", "Convertido", "Perdido"]


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=status)


def _camel(name: str) -> str:
    head, *tail = name.split("_")
    return head + "".join(part.title() for part in tail)


class _CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=_camel, populate_by_name=True, extra="ignore")


# ── Clientes ──────────────────────────────────────────────────────────────────

class TenantCreate(_CamelModel):
    restaurant_name: str = Field(min_length=1, max_length=120)
    owner_name: str = Field(min_length=1, max_length=120)
    email: str = Field(min_length=3, max_length=160)
    phone: str = Field(min_length=1, max_length=40)
    city: str = Field(min_length=1, max_length=80)
    business_type: str = "pizzeria"
    plan: Plan = "Free"
    status: TenantStatus = "active"


class TenantUpdate(_CamelModel):
    restaurant_name: str | None = Field(default=None, min_length=1, max_length=120)
    owner_name: str | None = Field(default=None, min_length=1, max_length=120)
    email: str | None = Field(default=None, min_length=3, max_length=160)
    phone: str | None = Field(default=None, min_length=1, max_length=40)
    city: str | None = Field(default=None, min_length=1, max_length=80)
    plan: Plan | None = None
    status: TenantStatus | None = None


class TenantImportItem(_CamelModel):
    id: str = Field(min_length=1, max_length=60)
    restaurant_name: str = Field(min_length=1, max_length=120)
    owner_name: str = ""
    email: str = ""
    phone: str = ""
    city: str = ""
    business_type: str = "pizzeria"
    plan: Plan = "Free"
    status: TenantStatus = "active"


class TenantImport(_CamelModel):
    tenants: list[TenantImportItem] = Field(max_length=500)


@saas_router.get("/tenants")
async def list_tenants(_: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Tenant).order_by(Tenant.created_at.desc(), Tenant.id))).scalars().all()
    return {"ok": True, "tenants": [tenant_to_dict(row) for row in rows]}


@saas_router.post("/tenants", status_code=201)
async def create_tenant(body: TenantCreate, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    if body.business_type not in BUSINESS_CATEGORIES:
        return _error(400, "invalid_business_type")
    tenant = Tenant(
        id=await unique_tenant_id(db, body.restaurant_name),
        restaurant_name=body.restaurant_name.strip(), owner_name=body.owner_name.strip(),
        email=body.email.strip().lower(), phone=body.phone.strip(), city=body.city.strip(),
        business_type=body.business_type, plan=body.plan, status=body.status,
    )
    db.add(tenant)
    await db.flush()
    return JSONResponse({"ok": True, "tenant": tenant_to_dict(tenant)}, status_code=201)


@saas_router.patch("/tenants/{tenant_id}")
async def update_tenant(tenant_id: str, body: TenantUpdate, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        return _error(404, "tenant_not_found")
    if body.plan is not None and body.plan != tenant.plan:
        # O valor cobrado no Asaas acompanha o plano; se o Asaas recusar, o plano não muda.
        if (code := await sync_subscription_plan(db, tenant_id, body.plan)) is not None:
            await db.rollback()
            return _error(503 if code == "billing_not_configured" else 502, code)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(tenant, field, value.strip() if isinstance(value, str) else value)
    await db.flush()
    return {"ok": True, "tenant": tenant_to_dict(tenant)}


@saas_router.delete("/tenants/{tenant_id}")
async def delete_tenant(tenant_id: str, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    if tenant_id in RESERVED_TENANT_IDS:
        return _error(400, "cannot_delete_platform_tenant")
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        return _error(404, "tenant_not_found")
    # O Asaas precisa parar de cobrar: se não der para cancelar, o cliente não é excluído.
    sub = await db.get(Subscription, tenant_id)
    if sub is not None:
        if sub.asaas_subscription_id and sub.status != "cancelled":
            try:
                await asaas.cancel_subscription(sub.asaas_subscription_id)
            except asaas.AsaasError as exc:
                logger.warning("Não foi possível cancelar a assinatura de %s: %s", tenant_id, exc)
                return _error(502, exc.code)
        await db.delete(sub)
    await db.delete(tenant)
    return {"ok": True}


@saas_router.post("/tenants/import")
async def import_tenants(body: TenantImport, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    """Traz para o servidor os clientes que só existiam no navegador do dono, e registra lojas com acesso sem cadastro."""
    # ON CONFLICT DO NOTHING: duas importações ao mesmo tempo (ou dois dispositivos) não se atropelam.
    rows = [
        {
            "id": item.id, "restaurant_name": item.restaurant_name.strip(), "owner_name": item.owner_name.strip(),
            "email": item.email.strip().lower(), "phone": item.phone.strip(), "city": item.city.strip(),
            "business_type": item.business_type if item.business_type in BUSINESS_CATEGORIES else "pizzeria",
            "plan": item.plan, "status": item.status,
        }
        for item in body.tenants if item.id not in RESERVED_TENANT_IDS
    ]
    imported = 0
    if rows:
        result = await db.execute(pg_insert(Tenant).values(rows).on_conflict_do_nothing(index_elements=[Tenant.id]))
        imported = result.rowcount or 0
    # Lojas que têm usuário mas nenhum cadastro: ficam Premium (como já funcionavam) até o dono ajustar.
    existing = {row for row in (await db.execute(select(Tenant.id))).scalars().all()}
    orphan_ids = {row for row in (await db.execute(select(User.tenant_id).distinct())).scalars().all()} - existing - RESERVED_TENANT_IDS
    registered = 0
    if orphan_ids:
        orphan_rows = [{"id": tenant_id, "restaurant_name": tenant_id, "plan": "Premium", "status": "active"} for tenant_id in sorted(orphan_ids)]
        result = await db.execute(pg_insert(Tenant).values(orphan_rows).on_conflict_do_nothing(index_elements=[Tenant.id]))
        registered = result.rowcount or 0
    return {"ok": True, "imported": imported, "registeredFromUsers": registered}


@tenant_router.get("/me")
async def my_tenant(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    return {"ok": True, "tenant": await tenant_payload(db, auth.tenant_id)}


class SlugIn(_CamelModel):
    slug: str = Field(default="", max_length=40)


@tenant_router.put("/slug")
async def set_my_slug(body: SlugIn, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    """O administrador da loja escolhe o endereço do cardápio (/pedido/<slug>). Vazio volta a usar o id."""
    if auth.role_key != "admin" or auth.is_platform_admin:
        return _error(403, "forbidden")
    tenant = await db.get(Tenant, auth.tenant_id)
    if tenant is None:
        return _error(404, "tenant_not_registered")
    slug = body.slug.strip().lower()
    if slug:
        error = await slug_error(db, tenant.id, slug)
        if error:
            return _error(400 if error != "slug_taken" else 409, error)
    tenant.slug = slug or None
    await db.flush()
    invalidate_slug_cache()
    return {"ok": True, "tenant": tenant_to_dict(tenant)}


# ── Catálogo de planos ────────────────────────────────────────────────────────

class PlanConfigIn(_CamelModel):
    key: Plan
    price: float = Field(ge=0, le=100000)
    active: bool = True
    description: str = Field(default="", max_length=400)


class PlanConfigsIn(_CamelModel):
    plans: list[PlanConfigIn] = Field(max_length=len(PLAN_KEYS))


@public_leads_router.get("/plans")
async def public_plans(db: AsyncSession = Depends(get_db)):
    """Preços e textos da página de vendas e do checkout."""
    return {"ok": True, "plans": await load_plans(db)}


@saas_router.put("/plans")
async def save_plans(body: PlanConfigsIn, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    if len({plan.key for plan in body.plans}) != len(body.plans):
        return _error(400, "duplicate_plan")
    for plan in body.plans:
        price = 0 if plan.key == "Free" else plan.price  # o plano gratuito é sempre R$ 0
        row = await db.get(PlanConfig, plan.key)
        if row is None:
            db.add(PlanConfig(key=plan.key, price=price, active=plan.active, description=plan.description.strip()))
        else:
            row.price, row.active, row.description = price, plan.active, plan.description.strip()
    await db.flush()
    return {"ok": True, "plans": await load_plans(db)}


# ── Leads da página de vendas ─────────────────────────────────────────────────

class LeadIn(_CamelModel):
    plan: Plan
    restaurant_name: str = Field(min_length=1, max_length=120)
    owner_name: str = Field(min_length=1, max_length=120)
    phone: str = Field(min_length=8, max_length=40)
    email: str = Field(min_length=3, max_length=160)
    city: str = Field(min_length=1, max_length=80)
    notes: str = Field(default="", max_length=1000)


class LeadUpdate(_CamelModel):
    status: LeadStatus


def _lead_to_dict(lead: Lead) -> dict:
    return {
        "id": lead.id, "plan": lead.plan, "restaurantName": lead.restaurant_name, "ownerName": lead.owner_name,
        "phone": lead.phone, "email": lead.email, "city": lead.city, "notes": lead.notes, "status": lead.status,
        "createdAt": lead.created_at.isoformat() if lead.created_at else None,
    }


# Limite simples por IP para o formulário público (por processo; basta para barrar abuso casual).
_LEADS_PER_HOUR = 30
_lead_attempts: dict[str, deque[float]] = defaultdict(deque)


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")


@public_leads_router.post("/leads", status_code=201)
async def create_lead(body: LeadIn, request: Request, db: AsyncSession = Depends(get_db)):
    attempts = _lead_attempts[_client_ip(request)]
    now = time.monotonic()
    while attempts and now - attempts[0] > 3600:
        attempts.popleft()
    if len(attempts) >= _LEADS_PER_HOUR:
        return _error(429, "too_many_requests")
    attempts.append(now)

    lead = Lead(
        plan=body.plan, restaurant_name=body.restaurant_name.strip(), owner_name=body.owner_name.strip(),
        phone=body.phone.strip(), email=body.email.strip().lower(), city=body.city.strip(), notes=body.notes.strip(),
    )
    db.add(lead)
    await db.flush()
    return JSONResponse({"ok": True}, status_code=201)


# ── Cadastro self-service ─────────────────────────────────────────────────────

class SignupIn(_CamelModel):
    plan: Plan
    restaurant_name: str = Field(min_length=2, max_length=120)
    owner_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=8, max_length=40)
    email: str = Field(min_length=5, max_length=160)
    city: str = Field(min_length=2, max_length=80)
    business_type: str = "pizzeria"
    username: str = Field(min_length=3, max_length=30)
    password: str = Field(min_length=8, max_length=128)


_SIGNUPS_PER_HOUR = 8
_signup_attempts: dict[str, deque[float]] = defaultdict(deque)


@public_leads_router.post("/signup", status_code=201)
async def signup(body: SignupIn, request: Request, response: Response, db: AsyncSession = Depends(get_db)):
    """Cria a loja e o administrador e já abre a sessão. A cobrança do plano pago vem depois, em /api/billing/checkout."""
    attempts = _signup_attempts[_client_ip(request)]
    now = time.monotonic()
    while attempts and now - attempts[0] > 3600:
        attempts.popleft()
    if len(attempts) >= _SIGNUPS_PER_HOUR:
        return _error(429, "too_many_requests")
    attempts.append(now)

    username = normalize_username(body.username)
    email = body.email.strip().lower()
    if not is_valid_username(username):
        return _error(400, "invalid_username")
    if "@" not in email:
        return _error(400, "invalid_email")
    if body.business_type not in BUSINESS_CATEGORIES:
        return _error(400, "invalid_business_type")
    if (await db.execute(select(User.id).where(User.username == username))).first() is not None:
        return _error(400, "username_already_exists")

    # A loja nasce no Free; o plano pago só passa a valer quando o Asaas aceitar a assinatura.
    tenant = Tenant(
        id=await unique_tenant_id(db, body.restaurant_name),
        restaurant_name=body.restaurant_name.strip(), owner_name=body.owner_name.strip(), email=email,
        phone=body.phone.strip(), city=body.city.strip(), business_type=body.business_type, plan="Free", status="active",
    )
    db.add(tenant)
    await db.flush()
    user = User(
        tenant_id=tenant.id, name=body.owner_name.strip(), username=username, email=email,
        role="Administrador", role_key="admin", shift="Gestão", password_hash=hash_password(body.password), permissions=[],
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as exc:
        if is_unique_violation(exc):
            await db.rollback()
            return _error(400, "username_already_exists")
        raise
    for index, name in enumerate(BUSINESS_CATEGORIES[body.business_type]):
        db.add(Category(name=name, tenant_id=tenant.id, menu_enabled=True, pos_enabled=True, sort_index=index))
    db.add(Lead(
        plan=body.plan, restaurant_name=tenant.restaurant_name, owner_name=tenant.owner_name, phone=tenant.phone,
        email=email, city=tenant.city, notes="Cadastro feito pelo próprio cliente.", status="Convertido",
    ))
    await db.flush()

    access, refresh = await new_session(db, user)
    set_auth_cookies(response, access, refresh)
    return {"ok": True, "user": _to_user_out(user), "tenantId": tenant.id, "tenant": tenant_to_dict(tenant)}


@saas_router.get("/leads")
async def list_leads(_: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(Lead).order_by(Lead.created_at.desc(), Lead.id.desc()).limit(500))).scalars().all()
    return {"ok": True, "leads": [_lead_to_dict(row) for row in rows]}


@saas_router.patch("/leads/{lead_id}")
async def update_lead(lead_id: int, body: LeadUpdate, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    lead = await db.get(Lead, lead_id)
    if lead is None:
        return _error(404, "lead_not_found")
    lead.status = body.status
    await db.flush()
    return {"ok": True, "lead": _lead_to_dict(lead)}


@saas_router.delete("/leads/{lead_id}")
async def delete_lead(lead_id: int, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    await db.execute(delete(Lead).where(Lead.id == lead_id))
    return {"ok": True}


# ── Auditoria ─────────────────────────────────────────────────────────────────

class AuditIn(_CamelModel):
    action: str = Field(min_length=1, max_length=120)
    target: str = Field(default="", max_length=240)


def _audit_to_dict(log: AuditLog) -> dict:
    return {"id": log.id, "action": log.action, "target": log.target, "actor": log.actor, "createdAt": log.created_at.isoformat()}


@saas_router.get("/audit")
async def list_audit(_: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(AuditLog).order_by(AuditLog.id.desc()).limit(300))).scalars().all()
    return {"ok": True, "logs": [_audit_to_dict(row) for row in rows]}


@saas_router.post("/audit", status_code=201)
async def add_audit(body: AuditIn, auth: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    user = await db.get(User, auth.user_id)
    log = AuditLog(action=body.action.strip(), target=body.target.strip(), actor=user.name if user else "Administrador SaaS")
    db.add(log)
    await db.flush()
    return JSONResponse({"ok": True, "log": _audit_to_dict(log)}, status_code=201)
