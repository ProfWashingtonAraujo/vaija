"""Rastreamento da entrega: o entregador (sem login, por link com token) envia a posição e o cliente a acompanha."""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import and_, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import CurrentAuth
from database import get_db
from integrations import notify_order
from models import Delivery, Order
from .orders import _order_to_dict

delivery_router = APIRouter(tags=["delivery"])
courier_router = APIRouter(tags=["courier"])
public_delivery_router = APIRouter(tags=["public"])

MIN_SECONDS_BETWEEN_LOCATIONS = 2
MANAGER_ROLES = {"admin", "manager"}
WAITING_LINK_MAX_AGE = timedelta(hours=24)


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
            "location": {"latitude": row.latitude, "longitude": row.longitude, "updatedAt": _iso(row.location_at)} if has_location else None,
        })

    names = (await db.execute(
        select(Delivery.courier_name).where(Delivery.tenant_id == auth.tenant_id, Delivery.courier_name.is_not(None)).distinct()
    )).scalars().all()
    return {"deliveries": items, "couriers": sorted(names, key=str.lower)}


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
    changed = order.status not in ("Entregue", "Cancelado")
    if changed:
        order.status = "Entregue"
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
