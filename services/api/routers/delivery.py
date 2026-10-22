"""Rastreamento da entrega: o entregador (sem login, por link com token) envia a posição e o cliente a acompanha."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, delete, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from auth import CurrentAuth
from database import get_db
from integrations import notify_order
from models import CashMovement, Courier, CourierPayout, Delivery, Order, RestaurantSettings, User
from .cash import _current_session
from .orders import _order_to_dict

delivery_router = APIRouter(tags=["delivery"])
courier_router = APIRouter(tags=["courier"])
public_delivery_router = APIRouter(tags=["public"])

MIN_SECONDS_BETWEEN_LOCATIONS = 2
MANAGER_ROLES = {"admin", "manager"}
WAITING_LINK_MAX_AGE = timedelta(hours=24)
DEFAULT_COURIER_PERCENT = 80.0


class CourierLinkIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    courierName: str | None = Field(default=None, max_length=60)


class LocationIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    latitude: float = Field(ge=-90, le=90)
    longitude: float = Field(ge=-180, le=180)
    accuracy: float | None = Field(default=None, ge=0)


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=status)


def _hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=timezone.utc)


def _iso(value: datetime | None) -> str | None:
    return _aware(value).astimezone(timezone.utc).isoformat().replace("+00:00", "Z") if value else None


async def _store_percent(db: AsyncSession, tenant_id: str) -> float:
    """% padrão da loja da taxa de entrega que vai para o entregador (Configurações → Entrega). Padrão: 80."""
    row = await db.get(RestaurantSettings, tenant_id)
    delivery = (row.data or {}).get("delivery") if row else None
    raw = delivery.get("courierPercent") if isinstance(delivery, dict) else None
    try:
        percent = float(str(raw).replace(",", ".")) if raw not in (None, "") else DEFAULT_COURIER_PERCENT
    except ValueError:
        percent = DEFAULT_COURIER_PERCENT
    return min(100.0, max(0.0, percent))


async def _percent_overrides(db: AsyncSession, tenant_id: str) -> dict[str, float]:
    """Entregadores com % própria no cadastro (chave: nome em minúsculas)."""
    rows = (await db.execute(
        select(Courier.name, Courier.pay_percent).where(Courier.tenant_id == tenant_id, Courier.pay_percent.is_not(None))
    )).all()
    return {name.lower(): min(100.0, max(0.0, float(percent))) for name, percent in rows}


async def _courier_percent(db: AsyncSession, tenant_id: str, courier_name: str | None = None) -> float:
    """% do entregador: a do cadastro dele, se houver; senão a padrão da loja."""
    if courier_name:
        override = (await _percent_overrides(db, tenant_id)).get(courier_name.lower())
        if override is not None:
            return override
    return await _store_percent(db, tenant_id)


def _pay(fee: float | None, percent: float) -> float:
    return round(float(fee or 0) * percent / 100, 2)


def _effective_pay(row: Delivery, fee: float, store_percent: float, overrides: dict[str, float]) -> float:
    """Repasse guardado na entrega; entregas antigas (sem valor guardado) usam a % de hoje."""
    if row.courier_pay is not None:
        return float(row.courier_pay)
    return _pay(fee, overrides.get((row.courier_name or "").lower(), store_percent))


async def _delivery_by_token(db: AsyncSession, token: str) -> Delivery | None:
    return (await db.execute(select(Delivery).where(Delivery.token_hash == _hash(token)))).scalar_one_or_none()


async def _order_of(db: AsyncSession, delivery: Delivery) -> Order | None:
    return await db.get(Order, (delivery.order_id, delivery.tenant_id))


def _job(order: Order, delivery: Delivery) -> dict:
    return {
        "orderId": order.id,
        "customer": order.customer,
        "phone": order.phone,
        "address": order.address,
        "items": order.items,
        "notes": order.notes,
        "payment": order.payment,
        "value": float(order.value),
        "started": delivery.started_at is not None,
        "finished": delivery.finished_at is not None,
    }


# ── Restaurante (autenticado) ─────────────────────────────────────────────────

@delivery_router.post("/api/orders/{order_id}/courier-link")
async def create_courier_link(order_id: int, auth: CurrentAuth, body: CourierLinkIn | None = None, db: AsyncSession = Depends(get_db)):
    """Gera (ou renova) o link do entregador. O token só aparece nesta resposta; guardamos o hash."""
    order = await db.get(Order, (order_id, auth.tenant_id))
    if order is None:
        return _error(404, "order_not_found")
    if (order.source or "Online") != "Online":
        return _error(400, "not_a_delivery_order")
    if order.status in ("Entregue", "Cancelado"):
        return _error(409, "order_closed")

    token = secrets.token_urlsafe(32)
    courier_name = (body.courierName or "").strip() or None if body else None
    delivery = await db.get(Delivery, (auth.tenant_id, order_id))
    if delivery is None:
        db.add(Delivery(tenant_id=auth.tenant_id, order_id=order_id, token_hash=_hash(token), courier_name=courier_name))
    else:
        if courier_name:
            delivery.courier_name = courier_name
        # link novo invalida o anterior; a entrega em andamento continua com a posição já enviada
        delivery.token_hash = _hash(token)
        delivery.finished_at = None
    await db.flush()
    return {"ok": True, "token": token}


@delivery_router.get("/api/deliveries")
async def list_deliveries(auth: CurrentAuth, since: str | None = None, db: AsyncSession = Depends(get_db)):
    """Visão do gerente: entregas em rota, aguardando o entregador iniciar e as finalizadas desde `since`."""
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")

    now = _now()
    try:
        since_dt = _aware(datetime.fromisoformat(since.replace("Z", "+00:00"))) if since else None
    except ValueError:
        since_dt = None
    if since_dt is None:
        since_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)

    rows = (await db.execute(
        select(Delivery).where(
            Delivery.tenant_id == auth.tenant_id,
            or_(
                and_(Delivery.finished_at.is_(None), or_(Delivery.started_at.is_not(None), Delivery.created_at >= now - WAITING_LINK_MAX_AGE)),
                Delivery.finished_at >= since_dt,
            ),
        )
    )).scalars().all()

    orders = {}
    if rows:
        found = await db.execute(select(Order).where(Order.tenant_id == auth.tenant_id, Order.id.in_([row.order_id for row in rows])))
        orders = {order.id: order for order in found.scalars().all()}

    items = []
    for row in rows:
        order = orders.get(row.order_id)
        if order is None:
            continue
        state = "finished" if row.finished_at else "active" if row.started_at else "waiting"
        if state != "finished" and order.status in ("Entregue", "Cancelado"):
            continue  # pedido encerrado por outro caminho (ex.: cliente retirou): não é mais uma entrega em andamento
        has_location = state == "active" and row.latitude is not None and row.longitude is not None
        items.append({
            "orderId": row.order_id,
            "state": state,
            "courierName": row.courier_name,
            "customer": order.customer,
            "address": order.address,
            "value": float(order.value),
            "createdAt": _iso(row.created_at),
            "startedAt": _iso(row.started_at),
            "finishedAt": _iso(row.finished_at),
            "finishedBy": row.finished_by,
            "location": {"latitude": row.latitude, "longitude": row.longitude, "updatedAt": _iso(row.location_at)} if has_location else None,
        })

    names = (await db.execute(
        select(Delivery.courier_name).where(Delivery.tenant_id == auth.tenant_id, Delivery.courier_name.is_not(None)).distinct()
    )).scalars().all()
    return {"deliveries": items, "couriers": sorted(names, key=str.lower)}


def _parse_range(start: str | None, end: str | None) -> tuple[datetime, datetime]:
    now = _now()
    try:
        start_dt = _aware(datetime.fromisoformat(start.replace("Z", "+00:00"))) if start else None
    except ValueError:
        start_dt = None
    try:
        end_dt = _aware(datetime.fromisoformat(end.replace("Z", "+00:00"))) if end else None
    except ValueError:
        end_dt = None
    if start_dt is None:
        start_dt = now.replace(hour=0, minute=0, second=0, microsecond=0)
    if end_dt is None or end_dt <= start_dt:
        end_dt = start_dt + timedelta(days=1)
    return start_dt, min(end_dt, start_dt + timedelta(days=366))


@delivery_router.get("/api/deliveries/earnings")
async def courier_earnings(auth: CurrentAuth, start: str | None = None, end: str | None = None, db: AsyncSession = Depends(get_db)):
    """Fechamento por período: quanto cada entregador recebe (% da taxa de entrega das entregas finalizadas)."""
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")

    start_dt, end_dt = _parse_range(start, end)
    percent = await _store_percent(db, auth.tenant_id)
    overrides = await _percent_overrides(db, auth.tenant_id)
    rows = (await db.execute(
        select(Delivery).where(
            Delivery.tenant_id == auth.tenant_id,
            Delivery.finished_at.is_not(None),
            Delivery.finished_at >= start_dt,
            Delivery.finished_at < end_dt,
        ).order_by(Delivery.finished_at)
    )).scalars().all()

    orders = {}
    if rows:
        found = await db.execute(select(Order).where(Order.tenant_id == auth.tenant_id, Order.id.in_([row.order_id for row in rows])))
        orders = {order.id: order for order in found.scalars().all()}

    groups: dict[str, dict] = {}
    for row in rows:
        order = orders.get(row.order_id)
        fee = float(order.delivery_fee or 0) if order else 0.0
        # entregas anteriores ao recurso não têm o valor guardado: usa a % de hoje
        pay = _effective_pay(row, fee, percent, overrides)
        paid = row.payout_id is not None
        name = row.courier_name or ""
        group = groups.setdefault(name, {
            "name": name, "count": 0, "fees": 0.0, "pay": 0.0, "paid": 0.0,
            "payPercent": overrides.get(name.lower()), "deliveries": [],
        })
        group["count"] += 1
        group["fees"] += fee
        group["pay"] += pay
        if paid:
            group["paid"] += pay
        group["deliveries"].append({
            "orderId": row.order_id,
            "customer": order.customer if order else "",
            "finishedAt": _iso(row.finished_at),
            "fee": fee,
            "pay": pay,
            "paid": paid,
        })

    couriers = []
    for group in sorted(groups.values(), key=lambda g: (g["name"] == "", g["name"].lower())):
        group["fees"] = round(group["fees"], 2)
        group["pay"] = round(group["pay"], 2)
        group["paid"] = round(group["paid"], 2)
        group["pending"] = round(group["pay"] - group["paid"], 2)
        group["store"] = round(group["fees"] - group["pay"], 2)
        couriers.append(group)

    fees = round(sum(g["fees"] for g in couriers), 2)
    pay = round(sum(g["pay"] for g in couriers), 2)
    paid_total = round(sum(g["paid"] for g in couriers), 2)
    return {
        "percent": percent,
        "start": _iso(start_dt),
        "end": _iso(end_dt),
        "couriers": couriers,
        "totals": {
            "count": sum(g["count"] for g in couriers), "fees": fees, "pay": pay,
            "paid": paid_total, "pending": round(pay - paid_total, 2), "store": round(fees - pay, 2),
        },
    }


class PayoutIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    courierName: str = Field(default="", max_length=60)
    start: str
    end: str
    # paga com dinheiro da gaveta: registra uma sangria no caixa aberto
    fromCash: bool = False


def _payout_dict(payout: CourierPayout) -> dict:
    return {
        "id": payout.id,
        "courierName": payout.courier_name or "",
        "amount": float(payout.amount),
        "count": payout.deliveries_count,
        "paidBy": payout.paid_by,
        "paidAt": _iso(payout.paid_at),
        "fromCash": payout.movement_id is not None,
    }


@delivery_router.get("/api/deliveries/payouts")
async def list_payouts(auth: CurrentAuth, start: str | None = None, end: str | None = None, db: AsyncSession = Depends(get_db)):
    """Pagamentos registrados que cobrem o período consultado."""
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    start_dt, end_dt = _parse_range(start, end)
    rows = (await db.execute(
        select(CourierPayout).where(
            CourierPayout.tenant_id == auth.tenant_id,
            CourierPayout.period_start < end_dt,
            CourierPayout.period_end > start_dt,
        ).order_by(CourierPayout.paid_at.desc())
    )).scalars().all()
    return {"payouts": [_payout_dict(row) for row in rows]}


@delivery_router.post("/api/deliveries/payouts")
async def create_payout(body: PayoutIn, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    """Marca como pagas as entregas finalizadas, ainda não quitadas, de um entregador no período."""
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    start_dt, end_dt = _parse_range(body.start, body.end)
    name = body.courierName.strip()
    cash_session = None
    if body.fromCash:
        cash_session = await _current_session(db, auth.tenant_id)
        if cash_session is None:
            return _error(409, "cash_closed")

    query = select(Delivery).where(
        Delivery.tenant_id == auth.tenant_id,
        Delivery.finished_at.is_not(None),
        Delivery.finished_at >= start_dt,
        Delivery.finished_at < end_dt,
        Delivery.payout_id.is_(None),
    )
    query = query.where(Delivery.courier_name == name) if name else query.where(or_(Delivery.courier_name.is_(None), Delivery.courier_name == ""))
    rows = (await db.execute(query)).scalars().all()
    if not rows:
        return _error(409, "nothing_to_pay")

    found = await db.execute(select(Order).where(Order.tenant_id == auth.tenant_id, Order.id.in_([row.order_id for row in rows])))
    orders = {order.id: order for order in found.scalars().all()}
    store_percent = await _store_percent(db, auth.tenant_id)
    overrides = await _percent_overrides(db, auth.tenant_id)

    total = 0.0
    for row in rows:
        order = orders.get(row.order_id)
        pay = _effective_pay(row, float(order.delivery_fee or 0) if order else 0.0, store_percent, overrides)
        row.courier_pay = pay  # congela o valor pago, mesmo que a % mude depois
        total += pay

    user = await db.get(User, auth.user_id)
    who = (user.name or user.username) if user else None
    movement = None
    if cash_session is not None:
        movement = CashMovement(
            tenant_id=auth.tenant_id,
            session_id=cash_session.id,
            kind="sangria",
            amount=round(total, 2),
            reason="entregador",
            note=f"Repasse · {name or 'Sem entregador informado'} · {len(rows)} {'entrega' if len(rows) == 1 else 'entregas'}",
            created_by=who or "Operador",
        )
        db.add(movement)
        await db.flush()
    payout = CourierPayout(
        tenant_id=auth.tenant_id,
        courier_name=name,
        amount=round(total, 2),
        deliveries_count=len(rows),
        period_start=start_dt,
        period_end=end_dt,
        paid_by=who,
        movement_id=movement.id if movement else None,
    )
    db.add(payout)
    await db.flush()
    for row in rows:
        row.payout_id = payout.id
    await db.flush()
    await db.refresh(payout)
    return {"ok": True, "payout": _payout_dict(payout)}


@delivery_router.delete("/api/deliveries/payouts/{payout_id}")
async def undo_payout(payout_id: int, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    """Desfaz um pagamento registrado por engano: as entregas voltam a aparecer como a pagar."""
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    payout = await db.get(CourierPayout, payout_id)
    if payout is None or payout.tenant_id != auth.tenant_id:
        return _error(404, "payout_not_found")
    if payout.movement_id is not None:
        movement = await db.get(CashMovement, payout.movement_id)
        if movement is not None and movement.voided_at is None:
            session = await _current_session(db, auth.tenant_id)
            if session is None or session.id != movement.session_id:
                return _error(409, "payout_cash_closed")  # o caixa em que saiu esse dinheiro já foi fechado
            user = await db.get(User, auth.user_id)
            movement.voided_at = _now()
            movement.voided_by = (user.name or user.username) if user else None
    await db.execute(update(Delivery).where(Delivery.tenant_id == auth.tenant_id, Delivery.payout_id == payout_id).values(payout_id=None))
    await db.execute(delete(CourierPayout).where(CourierPayout.id == payout_id))
    await db.flush()
    return {"ok": True}


@delivery_router.post("/api/deliveries/{order_id}/finish")
async def finish_delivery_manually(order_id: int, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    """Gerente/administrador encerra uma entrega em rota quando o entregador não consegue (ex.: celular sem bateria)."""
    if auth.role_key not in MANAGER_ROLES:
        return _error(403, "forbidden")
    delivery = await db.get(Delivery, (auth.tenant_id, order_id))
    order = await db.get(Order, (order_id, auth.tenant_id))
    if delivery is None or order is None:
        return _error(404, "delivery_not_found")
    if delivery.started_at is None:
        return _error(409, "delivery_not_started")
    if delivery.finished_at is not None or order.status in ("Entregue", "Cancelado"):
        return _error(409, "delivery_closed")

    user = await db.get(User, auth.user_id)
    delivery.finished_at = _now()
    delivery.finished_by = (user.name or user.username) if user else "Restaurante"
    delivery.latitude = delivery.longitude = delivery.accuracy = None  # não guarda a última posição
    delivery.courier_pay = _pay(order.delivery_fee, await _courier_percent(db, auth.tenant_id, delivery.courier_name))
    order.status = "Entregue"
    order.finished_at = _now()
    await db.commit()
    await notify_order(_order_to_dict(order))
    return {"ok": True}


# ── Entregador (por token) ────────────────────────────────────────────────────

@courier_router.get("/api/courier/{token}")
async def get_courier_job(token: str, db: AsyncSession = Depends(get_db)):
    delivery = await _delivery_by_token(db, token)
    order = await _order_of(db, delivery) if delivery else None
    if delivery is None or order is None:
        return _error(404, "invalid_link")
    return _job(order, delivery)


@courier_router.post("/api/courier/{token}/start")
async def start_delivery(token: str, db: AsyncSession = Depends(get_db)):
    delivery = await _delivery_by_token(db, token)
    order = await _order_of(db, delivery) if delivery else None
    if delivery is None or order is None:
        return _error(404, "invalid_link")
    if delivery.finished_at is not None or order.status in ("Entregue", "Cancelado"):
        return _error(409, "delivery_closed")

    if delivery.started_at is None:
        delivery.started_at = _now()
    changed = order.status != "Saiu para entrega"
    order.status = "Saiu para entrega"
    await db.commit()
    if changed:
        await notify_order(_order_to_dict(order))  # best-effort
    return {"ok": True}


@courier_router.post("/api/courier/{token}/location")
async def post_location(token: str, body: LocationIn, db: AsyncSession = Depends(get_db)):
    delivery = await _delivery_by_token(db, token)
    if delivery is None:
        return _error(404, "invalid_link")
    if delivery.started_at is None or delivery.finished_at is not None:
        return _error(409, "delivery_not_active")

    now = _now()
    if delivery.location_at and (now - _aware(delivery.location_at)).total_seconds() < MIN_SECONDS_BETWEEN_LOCATIONS:
        return {"ok": True}  # enviado rápido demais: ignora sem erro
    delivery.latitude, delivery.longitude = body.latitude, body.longitude
    delivery.accuracy = body.accuracy
    delivery.location_at = now
    return {"ok": True}


@courier_router.post("/api/courier/{token}/finish")
async def finish_delivery(token: str, db: AsyncSession = Depends(get_db)):
    delivery = await _delivery_by_token(db, token)
    order = await _order_of(db, delivery) if delivery else None
    if delivery is None or order is None:
        return _error(404, "invalid_link")
    if delivery.started_at is None:
        return _error(409, "delivery_not_started")

    if delivery.finished_at is None:
        delivery.finished_at = _now()
        delivery.latitude = delivery.longitude = delivery.accuracy = None  # não guarda a última posição
        delivery.courier_pay = _pay(order.delivery_fee, await _courier_percent(db, delivery.tenant_id, delivery.courier_name))
    changed = order.status not in ("Entregue", "Cancelado")
    if changed:
        order.status = "Entregue"
        order.finished_at = _now()
    await db.commit()
    if changed:
        await notify_order(_order_to_dict(order))
    return {"ok": True}


# ── Cliente (público) ─────────────────────────────────────────────────────────

@public_delivery_router.get("/api/public/{tenant_id}/orders/{order_id}/courier")
async def get_public_courier_location(tenant_id: str, order_id: int, db: AsyncSession = Depends(get_db)):
    """Posição do entregador, só durante a entrega. Fora dela devolve active=false, sem coordenadas."""
    delivery = await db.get(Delivery, (tenant_id, order_id))
    if (
        delivery is None
        or delivery.started_at is None
        or delivery.finished_at is not None
        or delivery.latitude is None
        or delivery.longitude is None
    ):
        return {"active": False}
    return {
        "active": True,
        "latitude": delivery.latitude,
        "longitude": delivery.longitude,
        "updatedAt": _aware(delivery.location_at).astimezone(timezone.utc).isoformat().replace("+00:00", "Z") if delivery.location_at else None,
    }
