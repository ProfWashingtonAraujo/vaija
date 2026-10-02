import httpx
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db
from models import Order
from schemas import OrderIn, PublicOrderIn, ALLOWED_STATUSES
from auth import CurrentAuth

orders_router = APIRouter(tags=["orders"])
public_orders_router = APIRouter(tags=["public"])
settings = get_settings()


def _order_to_dict(o: Order) -> dict:
    return {
        "id": o.id,
        "customer": o.customer,
        "phone": o.phone,
        "address": o.address,
        "items": o.items,
        "elapsed": o.elapsed,
        "value": float(o.value),
        "status": o.status,
        "payment": o.payment,
        "time": o.time,
        "source": o.source,
        "tableNumber": o.table_number,
        "deliveryFee": float(o.delivery_fee) if o.delivery_fee is not None else None,
        "notes": o.notes,
    }


async def _notify_n8n(order: Order) -> None:
    """Dispara webhook n8n quando status do pedido muda (não bloqueia)."""
    url = settings.n8n_order_status_webhook_url
    if not url:
        return
    items = order.items if isinstance(order.items, list) else []
    payload = {
        "orderId": order.id,
        "customer": order.customer,
        "phone": order.phone.replace(r"\D", ""),
        "rawPhone": order.phone,
        "status": order.status,
        "items": [str(i) for i in items],
        "value": float(order.value),
        "payment": order.payment,
        "time": order.time,
        "elapsed": order.elapsed,
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            await client.post(url, json=payload)
    except Exception:
        pass  # webhook é best-effort


# ── Authenticated ─────────────────────────────────────────────────────────────

@orders_router.get("/api/orders")
async def get_orders(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order)
        .where(Order.tenant_id == auth.tenant_id)
        .order_by(Order.sort_index)
    )
    orders = result.scalars().all()
    return {"orders": [_order_to_dict(o) for o in orders]}


@orders_router.put("/api/orders")
async def put_orders(
    body: list[OrderIn],
    auth: CurrentAuth,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(Order).where(Order.tenant_id == auth.tenant_id))
    for i, order_in in enumerate(body):
        if order_in.status not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail=f"status inválido: {order_in.status}")
        db.add(Order(
            id=order_in.id,
            tenant_id=auth.tenant_id,
            customer=order_in.customer,
            phone=order_in.phone,
            address=order_in.address,
            items=order_in.items,
            elapsed=order_in.elapsed,
            value=order_in.value,
            status=order_in.status,
            payment=order_in.payment,
            time=order_in.time,
            source=order_in.source,
            table_number=order_in.resolved_table_number(),
            delivery_fee=order_in.resolved_delivery_fee(),
            notes=order_in.notes,
            sort_index=i,
        ))
    await db.flush()
    return {"ok": True}


@orders_router.put("/api/orders/{order_id}/status")
async def update_order_status(
    order_id: int,
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Endpoint interno chamado por outros serviços com INTERNAL_API_KEY."""
    new_status = body.get("status", "")
    if new_status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="status inválido")

    result = await db.execute(select(Order).where(Order.id == order_id))
    order = result.scalar_one_or_none()
    if not order:
        raise HTTPException(status_code=404, detail="order_not_found")

    order.status = new_status
    await db.flush()
    await _notify_n8n(order)
    return {"ok": True}


# ── Public ────────────────────────────────────────────────────────────────────

@public_orders_router.get("/api/public/{tenant_id}/orders")
async def find_public_orders(tenant_id: str, phone: str = "", db: AsyncSession = Depends(get_db)):
    q = select(Order).where(Order.tenant_id == tenant_id)
    if phone:
        q = q.where(Order.phone == phone)
    result = await db.execute(q.order_by(Order.sort_index))
    orders = result.scalars().all()
    return {"orders": [_order_to_dict(o) for o in orders]}


@public_orders_router.post("/api/public/{tenant_id}/orders")
async def create_public_order(
    tenant_id: str,
    body: PublicOrderIn,
    db: AsyncSession = Depends(get_db),
):
    # gera próximo ID para o tenant
    result = await db.execute(
        select(func.coalesce(func.max(Order.id), 0)).where(Order.tenant_id == tenant_id)
    )
    next_id = (result.scalar_one() or 0) + 1

    now = datetime.now(timezone.utc)
    order = Order(
        id=next_id,
        tenant_id=tenant_id,
        customer=body.customer,
        phone=body.phone,
        address=body.address,
        items=body.items,
        elapsed="0 min",
        value=body.value,
        status="Pendente",
        payment=body.payment,
        time=now.strftime("%H:%M"),
        source="Online",
        table_number=body.table_number,
        delivery_fee=body.delivery_fee,
        notes=body.notes,
        sort_index=next_id,
    )
    db.add(order)
    await db.flush()
    return {"ok": True, "order": _order_to_dict(order)}
