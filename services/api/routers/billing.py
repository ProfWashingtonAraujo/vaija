"""Cobrança da mensalidade do Vaija: o lojista assina um plano e o Asaas cobra todo mês.

O Asaas avisa por webhook (/api/billing/webhook/asaas); é o webhook que muda o status da
assinatura e das faturas. O acesso do lojista é calculado aqui, no servidor.
"""
import calendar
import hmac
import logging
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

import asaas
from auth import CurrentAuth, PlatformAdmin
from config import get_settings
from database import get_db
from models import Invoice, Subscription, Tenant

logger = logging.getLogger(__name__)
billing_router = APIRouter(prefix="/api/billing", tags=["billing"])
billing_webhook_router = APIRouter(prefix="/api/billing/webhook", tags=["billing"])

# Preço é decidido aqui: o front nunca manda valor.
PLAN_PRICES: dict[str, float] = {"Free": 0, "Start": 79, "Pro": 149, "Premium": 249}
Plan = Literal["Free", "Start", "Pro", "Premium"]
BillingType = Literal["PIX", "BOLETO", "CREDIT_CARD"]


class CheckoutIn(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    plan: Plan
    billing_type: BillingType = Field(alias="billingType", default="PIX")
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=5, max_length=160)
    cpf_cnpj: str = Field(alias="cpfCnpj", min_length=11, max_length=18)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=status)


def _add_month(value: datetime) -> datetime:
    year, month = divmod(value.month, 12)
    year, month = value.year + year, month + 1
    return value.replace(year=year, month=month, day=min(value.day, calendar.monthrange(year, month)[1]))


def _only_digits(value: str) -> str:
    return "".join(ch for ch in value if ch.isdigit())


def compute_access(sub: Subscription | None) -> str:
    """'full' ou 'restricted'. Tenant sem assinatura (cadastrado antes da cobrança) segue liberado."""
    if sub is None:
        return "full"
    now = _now()
    if sub.status == "active":
        return "full"
    if sub.status == "trialing":
        return "full" if sub.trial_ends_at and sub.trial_ends_at > now else "restricted"
    if sub.status == "past_due":
        grace = timedelta(days=get_settings().billing_grace_days)
        return "full" if sub.overdue_since and now < sub.overdue_since + grace else "restricted"
    return "restricted"


def _sub_to_dict(sub: Subscription | None) -> dict:
    if sub is None:
        return {"status": "none", "access": "full", "plan": None}
    return {
        "status": sub.status, "access": compute_access(sub), "plan": sub.plan,
        "billingType": sub.billing_type,
        "trialEndsAt": sub.trial_ends_at.isoformat() if sub.trial_ends_at else None,
        "currentPeriodEnd": sub.current_period_end.isoformat() if sub.current_period_end else None,
        "overdueSince": sub.overdue_since.isoformat() if sub.overdue_since else None,
    }


def _invoice_to_dict(inv: Invoice) -> dict:
    return {
        "id": inv.id, "tenantId": inv.tenant_id, "amount": float(inv.amount), "status": inv.status,
        "billingType": inv.billing_type, "dueDate": inv.due_date.isoformat(),
        "paidAt": inv.paid_at.isoformat() if inv.paid_at else None, "invoiceUrl": inv.invoice_url,
    }


_PAYMENT_STATUS = {
    "PENDING": "open", "AWAITING_RISK_ANALYSIS": "open",
    "RECEIVED": "paid", "CONFIRMED": "paid", "RECEIVED_IN_CASH": "paid",
    "OVERDUE": "overdue",
    "REFUNDED": "refunded", "REFUND_REQUESTED": "refunded", "CHARGEBACK_REQUESTED": "refunded",
}


def _parse_date(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value).replace(tzinfo=timezone.utc)


async def _upsert_invoice(db: AsyncSession, tenant_id: str, payment: dict, status: str | None = None) -> Invoice:
    invoice = (await db.execute(select(Invoice).where(Invoice.asaas_payment_id == payment["id"]))).scalar_one_or_none()
    if invoice is None:
        invoice = Invoice(tenant_id=tenant_id, asaas_payment_id=payment["id"])
        db.add(invoice)
    invoice.amount = payment.get("value", 0)
    invoice.status = status or _PAYMENT_STATUS.get(payment.get("status", ""), "open")
    invoice.billing_type = payment.get("billingType")
    invoice.due_date = _parse_date(payment.get("dueDate")) or _now()
    paid_on = payment.get("paymentDate") or payment.get("clientPaymentDate")
    invoice.paid_at = (_parse_date(paid_on) or _now()) if invoice.status == "paid" else None
    invoice.invoice_url = payment.get("invoiceUrl")
    return invoice


async def _set_tenant_plan(db: AsyncSession, tenant_id: str, plan: str, body: "CheckoutIn") -> None:
    """O plano que libera as telas é o do cadastro do cliente, no servidor."""
    tenant = await db.get(Tenant, tenant_id)
    if tenant is None:
        db.add(Tenant(id=tenant_id, restaurant_name=body.name, owner_name=body.name, email=body.email, plan=plan))
    else:
        tenant.plan = plan


async def _sync_from_gateway(db: AsyncSession, sub: Subscription) -> None:
    """Reconcilia faturas e status com o Asaas; cobre webhook perdido ou ainda não configurado."""
    if not sub.asaas_subscription_id or sub.status == "cancelled":
        return
    try:
        payments = await asaas.list_subscription_payments(sub.asaas_subscription_id)
    except asaas.AsaasError as exc:
        logger.warning("Não foi possível sincronizar a assinatura %s: %s", sub.asaas_subscription_id, exc)
        return
    invoices = [await _upsert_invoice(db, sub.tenant_id, payment) for payment in payments]
    overdue = [i for i in invoices if i.status == "overdue"]
    paid = [i for i in invoices if i.status == "paid"]
    if overdue:
        sub.status = "past_due"
        sub.overdue_since = sub.overdue_since or _now()
    elif paid:
        sub.status, sub.overdue_since = "active", None
        sub.current_period_end = _add_month(max(i.due_date for i in paid))


# ── Lojista ───────────────────────────────────────────────────────────────────

@billing_router.get("/access")
async def my_access(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    """Consulta leve (sem falar com o Asaas) usada pelo painel para decidir se libera ou bloqueia."""
    data = _sub_to_dict(await db.get(Subscription, auth.tenant_id))
    return {"ok": True, "access": data["access"], "status": data["status"], "plan": data["plan"]}


@billing_router.get("/status")
async def my_billing(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    sub = await db.get(Subscription, auth.tenant_id)
    if sub:
        await _sync_from_gateway(db, sub)
    invoices = (await db.execute(
        select(Invoice).where(Invoice.tenant_id == auth.tenant_id).order_by(Invoice.due_date.desc()).limit(24)
    )).scalars().all()
    return {"ok": True, "subscription": _sub_to_dict(sub), "invoices": [_invoice_to_dict(i) for i in invoices], "prices": PLAN_PRICES, "trialDays": get_settings().billing_trial_days}


@billing_router.post("/checkout")
async def checkout(body: CheckoutIn, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    if auth.role_key != "admin" or auth.tenant_id == "admin":
        return _error(403, "forbidden")
    cpf_cnpj = _only_digits(body.cpf_cnpj)
    if len(cpf_cnpj) not in (11, 14):
        return _error(400, "invalid_cpf_cnpj")

    settings = get_settings()
    price = PLAN_PRICES[body.plan]
    sub = await db.get(Subscription, auth.tenant_id)
    now = _now()

    # Free não passa pelo gateway.
    if price == 0:
        if sub and sub.asaas_subscription_id and sub.status != "cancelled":
            try:
                await asaas.cancel_subscription(sub.asaas_subscription_id)
            except asaas.AsaasError as exc:
                logger.warning("Falha ao cancelar assinatura %s: %s", sub.asaas_subscription_id, exc)
                return _error(502, exc.code)
        if sub is None:
            sub = Subscription(tenant_id=auth.tenant_id)
            db.add(sub)
        sub.plan, sub.status, sub.billing_type = "Free", "active", None
        sub.asaas_subscription_id, sub.overdue_since = None, None
        await _set_tenant_plan(db, auth.tenant_id, "Free", body)
        return {"ok": True, "subscription": _sub_to_dict(sub), "invoiceUrl": None}

    # Trial só na primeira assinatura paga do tenant.
    first_time = sub is None or sub.trial_ends_at is None
    trial_ends_at = now + timedelta(days=settings.billing_trial_days) if first_time else sub.trial_ends_at
    in_trial = trial_ends_at > now
    next_due = (trial_ends_at if in_trial else now + timedelta(days=1)).date()
    if sub is None:
        sub = Subscription(tenant_id=auth.tenant_id, plan=body.plan, status="cancelled")
        db.add(sub)

    try:
        if not sub.asaas_customer_id:
            customer = await asaas.create_customer(body.name, body.email, cpf_cnpj, auth.tenant_id)
            sub.asaas_customer_id = customer["id"]
        if sub.asaas_subscription_id and sub.status != "cancelled":
            await asaas.update_subscription(sub.asaas_subscription_id, body.billing_type, price, body.plan)
        else:
            created = await asaas.create_subscription(
                sub.asaas_customer_id, body.billing_type, price, next_due.isoformat(), body.plan, auth.tenant_id,
            )
            sub.asaas_subscription_id = created["id"]
            sub.status = "trialing" if in_trial else "past_due"
            sub.overdue_since = None if in_trial else now
        payments = await asaas.list_subscription_payments(sub.asaas_subscription_id)
    except asaas.AsaasError as exc:
        logger.warning("Checkout recusado pelo Asaas (tenant %s): %s", auth.tenant_id, exc)
        await db.rollback()  # não deixa assinatura pela metade no banco
        return _error(503 if exc.code == "billing_not_configured" else 502, exc.code)

    sub.plan, sub.billing_type = body.plan, body.billing_type
    sub.customer_name, sub.customer_email, sub.customer_cpf_cnpj = body.name, body.email, cpf_cnpj
    sub.trial_ends_at = trial_ends_at
    await _set_tenant_plan(db, auth.tenant_id, body.plan, body)
    await db.flush()

    invoice_url = None
    for payment in payments:
        invoice = await _upsert_invoice(db, auth.tenant_id, payment)
        if invoice.status in ("open", "overdue"):
            invoice_url = invoice.invoice_url
    return {"ok": True, "subscription": _sub_to_dict(sub), "invoiceUrl": invoice_url}


@billing_router.post("/cancel")
async def cancel(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    if auth.role_key != "admin" or auth.tenant_id == "admin":
        return _error(403, "forbidden")
    sub = await db.get(Subscription, auth.tenant_id)
    if sub is None or sub.status == "cancelled":
        return _error(404, "subscription_not_found")
    if sub.asaas_subscription_id:
        try:
            await asaas.cancel_subscription(sub.asaas_subscription_id)
        except asaas.AsaasError as exc:
            return _error(502, exc.code)
    sub.status = "cancelled"
    return {"ok": True, "subscription": _sub_to_dict(sub)}


# ── Dono da plataforma ────────────────────────────────────────────────────────

@billing_router.get("/admin/subscriptions")
async def all_subscriptions(_: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    subs = (await db.execute(select(Subscription).order_by(Subscription.created_at.desc()))).scalars().all()
    return {"ok": True, "subscriptions": [{"tenantId": s.tenant_id, "customerName": s.customer_name, **_sub_to_dict(s)} for s in subs]}


@billing_router.post("/admin/cancel/{tenant_id}")
async def admin_cancel(tenant_id: str, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    """Cancela a cobrança recorrente de uma loja (ex.: ao excluir o cliente), para o Asaas parar de cobrar."""
    sub = await db.get(Subscription, tenant_id)
    if sub is None or sub.status == "cancelled":
        return {"ok": True, "cancelled": False}
    if sub.asaas_subscription_id:
        try:
            await asaas.cancel_subscription(sub.asaas_subscription_id)
        except asaas.AsaasError as exc:
            return _error(502, exc.code)
    sub.status = "cancelled"
    return {"ok": True, "cancelled": True}


@billing_router.get("/admin/invoices")
async def all_invoices(_: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    invoices = (await db.execute(select(Invoice).order_by(Invoice.due_date.desc()).limit(500))).scalars().all()
    return {"ok": True, "invoices": [_invoice_to_dict(i) for i in invoices]}


# ── Webhook do Asaas ──────────────────────────────────────────────────────────

@billing_webhook_router.post("/asaas")
async def asaas_webhook(
    request: Request,
    asaas_access_token: str | None = Header(default=None),
    db: AsyncSession = Depends(get_db),
):
    expected = get_settings().asaas_webhook_token
    if not expected:
        raise HTTPException(status_code=503, detail="billing_not_configured")
    if not asaas_access_token or not hmac.compare_digest(asaas_access_token, expected):
        raise HTTPException(status_code=401, detail="invalid_webhook_token")

    event = await request.json()
    name = event.get("event", "")
    payment = event.get("payment") or {}
    sub_id = payment.get("subscription") or (event.get("subscription") or {}).get("id")
    sub = None
    if sub_id:
        sub = (await db.execute(select(Subscription).where(Subscription.asaas_subscription_id == sub_id))).scalar_one_or_none()
    if sub is None:
        # Cobrança avulsa ou de outra origem: confirma o recebimento e ignora.
        return {"ok": True, "ignored": True}

    if name == "SUBSCRIPTION_DELETED":
        sub.status = "cancelled"
    elif payment:
        if name in ("PAYMENT_RECEIVED", "PAYMENT_CONFIRMED"):
            invoice = await _upsert_invoice(db, sub.tenant_id, payment, "paid")
            sub.status, sub.overdue_since = "active", None
            sub.current_period_end = _add_month(invoice.due_date)
        elif name == "PAYMENT_OVERDUE":
            await _upsert_invoice(db, sub.tenant_id, payment, "overdue")
            if sub.status != "cancelled":
                sub.status = "past_due"
                sub.overdue_since = sub.overdue_since or _now()
        elif name in ("PAYMENT_DELETED", "PAYMENT_REFUNDED"):
            await _upsert_invoice(db, sub.tenant_id, payment, "cancelled" if name == "PAYMENT_DELETED" else "refunded")
        elif name in ("PAYMENT_CREATED", "PAYMENT_UPDATED"):
            await _upsert_invoice(db, sub.tenant_id, payment)
    return {"ok": True}
