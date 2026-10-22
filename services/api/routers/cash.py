"""Controle de caixa: abertura com fundo de troco, sangria/suprimento, leitura X e fechamento com contagem.

Cada abertura cria uma sessão (turno), e não um "dia": pizzaria que fecha depois da meia-noite continua
no mesmo caixa. Uma venda entra na sessão em que o pedido foi finalizado (Entregue); cancelados ficam à parte.
Só administrador e gerente mexem no caixa.
"""
from datetime import datetime, timezone
from decimal import Decimal
from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import CurrentAuth
from database import get_db
from models import CashMovement, CashRegister, CashSession, Order, User

cash_router = APIRouter(tags=["cash"])

MANAGER_ROLES = {"admin", "manager"}
PAYMENT_METHODS = ("Pix", "Cartão", "Dinheiro")
SOURCES = ("Mesa", "Online", "Retirada")
REASONS = {
    "sangria": {"cofre", "gas", "gelo", "compra", "outro"},
    "suprimento": {"troco", "outro"},
}
MAX_AMOUNT = 1_000_000


class OpenIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    openingFloat: float = Field(ge=0, le=MAX_AMOUNT)
    note: str | None = Field(default=None, max_length=120)


class MovementIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    kind: Literal["sangria", "suprimento"]
    amount: float = Field(gt=0, le=MAX_AMOUNT)
    reason: str = Field(min_length=1, max_length=30)
    note: str | None = Field(default=None, max_length=120)


class CloseIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    countedCash: float = Field(ge=0, le=MAX_AMOUNT)
    note: str | None = Field(default=None, max_length=120)


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=status)


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    aware = value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    return aware.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def _money(value) -> float:
    return round(float(value or 0), 2)


async def _who(db: AsyncSession, auth) -> str:
    user = (await db.execute(
        select(User).where(User.id == auth.user_id, User.tenant_id == auth.tenant_id)
    )).scalar_one_or_none()
    return (user.name or user.username) if user else "Operador"


async def _current_session(db: AsyncSession, tenant_id: str) -> CashSession | None:
    return (await db.execute(
        select(CashSession).where(CashSession.tenant_id == tenant_id, CashSession.closed_at.is_(None)).order_by(CashSession.id.desc())
    )).scalars().first()


async def _lock_register(db: AsyncSession, tenant_id: str) -> CashRegister:
    """Trava a linha do estado do caixa: duas aberturas ao mesmo tempo não criam duas sessões."""
    row = (await db.execute(
        select(CashRegister).where(CashRegister.tenant_id == tenant_id).with_for_update()
    )).scalar_one_or_none()
    if row is None:
        row = CashRegister(tenant_id=tenant_id, is_open=False)
        db.add(row)
        await db.flush()
    return row


def _movement_dict(movement: CashMovement) -> dict:
    return {
        "id": movement.id,
        "kind": movement.kind,
        "amount": _money(movement.amount),
        "reason": movement.reason,
        "note": movement.note,
        "createdBy": movement.created_by,
        "createdAt": _iso(movement.created_at),
    }


def _session_dict(session: CashSession) -> dict:
    return {
        "id": session.id,
        "openedAt": _iso(session.opened_at),
        "openedBy": session.opened_by,
        "openingFloat": _money(session.opening_float),
        "openingNote": session.opening_note,
        "closedAt": _iso(session.closed_at),
        "closedBy": session.closed_by,
        "closingNote": session.closing_note,
        "countedCash": _money(session.counted_cash) if session.counted_cash is not None else None,
        "expectedCash": _money(session.expected_cash) if session.expected_cash is not None else None,
        "difference": _money(session.difference) if session.difference is not None else None,
    }


async def _build_report(db: AsyncSession, session: CashSession, end: datetime) -> dict:
    """Leitura da sessão: vendas por forma de pagamento, movimentações e o dinheiro que deveria estar no caixa."""
    orders = (await db.execute(
        select(Order).where(
            Order.tenant_id == session.tenant_id,
            Order.finished_at.is_not(None),
            Order.finished_at >= session.opened_at,
            Order.finished_at <= end,
            Order.status.in_(("Entregue", "Cancelado")),
        )
    )).scalars().all()

    sold = [order for order in orders if order.status == "Entregue"]
    cancelled = [order for order in orders if order.status == "Cancelado"]

    by_payment: dict[str, dict] = {method: {"method": method, "count": 0, "total": Decimal(0)} for method in PAYMENT_METHODS}
    by_source: dict[str, dict] = {source: {"source": source, "count": 0, "total": Decimal(0)} for source in SOURCES}
    gross = Decimal(0)
    fees = Decimal(0)
    pix_unconfirmed_count = 0
    pix_unconfirmed_total = Decimal(0)
    for order in sold:
        value = Decimal(order.value or 0)
        gross += value
        fees += Decimal(order.delivery_fee or 0)
        payment = by_payment.setdefault(order.payment, {"method": order.payment, "count": 0, "total": Decimal(0)})
        payment["count"] += 1
        payment["total"] += value
        source = by_source.setdefault(order.source or "Online", {"source": order.source or "Online", "count": 0, "total": Decimal(0)})
        source["count"] += 1
        source["total"] += value
        if order.payment == "Pix" and not order.paid:
            pix_unconfirmed_count += 1
            pix_unconfirmed_total += value

    movements = (await db.execute(
        select(CashMovement).where(CashMovement.tenant_id == session.tenant_id, CashMovement.session_id == session.id).order_by(CashMovement.created_at, CashMovement.id)
    )).scalars().all()
    sangrias = sum((Decimal(m.amount) for m in movements if m.kind == "sangria"), Decimal(0))
    suprimentos = sum((Decimal(m.amount) for m in movements if m.kind == "suprimento"), Decimal(0))

    opening_float = Decimal(session.opening_float or 0)
    cash_sales = by_payment["Dinheiro"]["total"]
    expected = opening_float + cash_sales + suprimentos - sangrias

    return {
        "session": _session_dict(session),
        "period": {"start": _iso(session.opened_at), "end": _iso(end)},
        "sales": {
            "count": len(sold),
            "gross": _money(gross),
            "deliveryFees": _money(fees),
            "products": _money(gross - fees),
            "byPayment": [{"method": row["method"], "count": row["count"], "total": _money(row["total"])} for row in by_payment.values()],
            "bySource": [{"source": row["source"], "count": row["count"], "total": _money(row["total"])} for row in by_source.values()],
        },
        "pix": {"unconfirmedCount": pix_unconfirmed_count, "unconfirmedTotal": _money(pix_unconfirmed_total)},
        "cancelled": {"count": len(cancelled), "total": _money(sum((Decimal(o.value or 0) for o in cancelled), Decimal(0)))},
        "movements": [_movement_dict(m) for m in movements],
        "cash": {
            "openingFloat": _money(opening_float),
            "cashSales": _money(cash_sales),
            "suprimentos": _money(suprimentos),
            "sangrias": _money(sangrias),
            "expected": _money(expected),
        },
    }


# ── Estado e leitura X ────────────────────────────────────────────────────────

@cash_router.get("/api/cash/current")
async def current_cash(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    """Sessão aberta com a leitura X (parcial, não fecha nada). Sem sessão aberta: {"open": false}."""
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    session = await _current_session(db, auth.tenant_id)
    if session is None:
        return {"open": False}
    return {"open": True, "report": await _build_report(db, session, _now())}


# ── Abertura ──────────────────────────────────────────────────────────────────

@cash_router.post("/api/cash/open")
async def open_cash(body: OpenIn, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    register = await _lock_register(db, auth.tenant_id)
    if await _current_session(db, auth.tenant_id) is not None:
        return _error(409, "already_open")

    who = await _who(db, auth)
    now = _now()
    session = CashSession(
        tenant_id=auth.tenant_id,
        opened_at=now,
        opened_by=who,
        opening_float=round(body.openingFloat, 2),
        opening_note=(body.note or "").strip() or None,
    )
    db.add(session)
    register.is_open = True
    register.opened_at, register.opened_by = now, who
    await db.flush()
    return {"ok": True, "open": True, "report": await _build_report(db, session, now)}


# ── Sangria e suprimento ──────────────────────────────────────────────────────

@cash_router.post("/api/cash/movements")
async def add_movement(body: MovementIn, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    if body.reason not in REASONS[body.kind]:
        return _error(400, "invalid_reason")
    session = await _current_session(db, auth.tenant_id)
    if session is None:
        return _error(409, "cash_closed")

    db.add(CashMovement(
        tenant_id=auth.tenant_id,
        session_id=session.id,
        kind=body.kind,
        amount=round(body.amount, 2),
        reason=body.reason,
        note=(body.note or "").strip() or None,
        created_by=await _who(db, auth),
    ))
    await db.flush()
    return {"ok": True, "report": await _build_report(db, session, _now())}


# ── Fechamento (leitura Z) ────────────────────────────────────────────────────

@cash_router.post("/api/cash/close")
async def close_cash(body: CloseIn, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    """Fecha a sessão com o dinheiro contado e congela o relatório. O contado é obrigatório."""
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    register = await _lock_register(db, auth.tenant_id)
    session = await _current_session(db, auth.tenant_id)
    if session is None:
        return _error(409, "cash_closed")

    who = await _who(db, auth)
    now = _now()
    report = await _build_report(db, session, now)
    expected = report["cash"]["expected"]
    counted = round(body.countedCash, 2)

    session.closed_at = now
    session.closed_by = who
    session.closing_note = (body.note or "").strip() or None
    session.counted_cash = counted
    session.expected_cash = expected
    session.difference = round(counted - expected, 2)
    register.is_open = False
    register.closed_at, register.closed_by = now, who

    report["session"] = _session_dict(session)
    report["period"]["end"] = _iso(now)
    session.summary = report
    await db.flush()
    return {"ok": True, "open": False, "report": report}


# ── Histórico ─────────────────────────────────────────────────────────────────

@cash_router.get("/api/cash/sessions")
async def list_sessions(auth: CurrentAuth, limit: int = 60, db: AsyncSession = Depends(get_db)):
    """Caixas já fechados, do mais recente para o mais antigo."""
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    rows = (await db.execute(
        select(CashSession)
        .where(CashSession.tenant_id == auth.tenant_id, CashSession.closed_at.is_not(None))
        .order_by(CashSession.closed_at.desc())
        .limit(max(1, min(limit, 200)))
    )).scalars().all()
    items = []
    for row in rows:
        summary = row.summary or {}
        sales = summary.get("sales", {})
        items.append({**_session_dict(row), "salesCount": sales.get("count", 0), "gross": sales.get("gross", 0)})
    return {"sessions": items}


@cash_router.get("/api/cash/sessions/{session_id}")
async def get_session(session_id: int, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    """Relatório congelado de um caixa fechado."""
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    session = await db.get(CashSession, session_id)
    if session is None or session.tenant_id != auth.tenant_id:
        return _error(404, "session_not_found")
    if session.closed_at is None:
        return {"report": await _build_report(db, session, _now())}
    return {"report": session.summary or await _build_report(db, session, session.closed_at)}
