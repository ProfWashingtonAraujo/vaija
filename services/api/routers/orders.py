import asyncio
import re
import secrets

from fastapi import APIRouter, Depends, Header
from fastapi.responses import JSONResponse
from sqlalchemy import delete, func, select, text, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from auth import CurrentAuth
from config import get_settings
from database import get_db
from integrations import notify_order, try_enqueue_print
from models import Order
from .catalog import blocked_product_names
from schemas import ALLOWED_STATUSES, OrderIn, OrderStatusUpdate, OrdersPayload

orders_router = APIRouter(tags=["orders"])
public_orders_router = APIRouter(tags=["public"])
settings = get_settings()


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=status)


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
        "createdAt": o.created_at.isoformat() if o.created_at else None,
    }


def _order_values(order: OrderIn, tenant_id: str, sort_index: int) -> dict:
    return {
        "id": order.id,
        "tenant_id": tenant_id,
        "customer": order.customer,
        "phone": order.phone,
        "address": order.address,
        "items": order.items,
        "elapsed": order.elapsed,
        "value": order.value,
        "status": order.status,
        "payment": order.payment,
        "time": order.time,
        "source": order.source or "Online",
        "table_number": order.table_number,
        "delivery_fee": order.delivery_fee,
        "notes": order.notes or "",
        "sort_index": sort_index,
    }


async def _notify_all(orders: list[dict]) -> int:
    """Notifica o n8n em paralelo e devolve quantas notificações falharam."""
    results = await asyncio.gather(*(notify_order(order) for order in orders))
    return sum(1 for ok in results if not ok)


# ── Authenticated ─────────────────────────────────────────────────────────────

@orders_router.get("/api/orders")
async def get_orders(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Order).where(Order.tenant_id == auth.tenant_id).order_by(Order.sort_index)
    )
    return {"orders": [_order_to_dict(o) for o in result.scalars().all()]}


@orders_router.put("/api/orders")
async def put_orders(payload: OrdersPayload, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    """Substitui a lista de pedidos do tenant (upsert + remoção dos ausentes), como no Go.

    Pedidos novos vão para a fila de impressão; pedidos novos ou com status alterado disparam o n8n.
    """
    orders = payload.orders
    if orders is None or any(not order.is_valid() for order in orders):
        return _error(400, "invalid_orders_payload")

    previous = {
        order_id: status
        for order_id, status in (await db.execute(
            select(Order.id, Order.status).where(Order.tenant_id == auth.tenant_id)
        )).all()
    }
    added: list[OrderIn] = []
    changed: list[OrderIn] = []
    for index, order in enumerate(orders):
        old_status = previous.get(order.id)
        if old_status is None:
            added.append(order)
        if old_status is None or old_status != order.status:
            changed.append(order)
        values = _order_values(order, auth.tenant_id, index)
        await db.execute(
            insert(Order).values(**values).on_conflict_do_update(
                index_elements=[Order.id, Order.tenant_id],
                set_={key: value for key, value in values.items() if key not in ("id", "tenant_id")},
            )
        )

    remove = delete(Order).where(Order.tenant_id == auth.tenant_id)
    if orders:
        remove = remove.where(Order.id.not_in([order.id for order in orders]))
    await db.execute(remove)
    await db.commit()

    failed = await _notify_all([o.model_dump(by_alias=True) for o in changed])
    for order in added:
        await try_enqueue_print(order.model_dump(by_alias=True))

    return {
        "ok": True,
        "orders": [o.model_dump(by_alias=True) for o in orders],
        "notifications": {"changed": len(changed), "failed": failed},
    }


@orders_router.put("/api/orders/{order_id}/status")
async def update_order_status(
    order_id: int,
    body: OrderStatusUpdate,
    db: AsyncSession = Depends(get_db),
    x_internal_api_key: str | None = Header(default=None),
):
    """Endpoint interno (ex.: serviço de pagamentos). Exige X-Internal-API-Key."""
    expected = settings.internal_api_key
    if not x_internal_api_key or not expected or not secrets.compare_digest(x_internal_api_key, expected):
        return _error(401, "invalid_internal_api_key")
    if body.status not in ALLOWED_STATUSES:
        return _error(400, "invalid_order_status")

    tenant_id = body.tenant_id or "default"
    result = await db.execute(select(Order).where(Order.id == order_id, Order.tenant_id == tenant_id))
    order = result.scalar_one_or_none()
    if not order:
        return _error(404, "order_not_found")

    order.status = body.status
    await db.commit()
    data = _order_to_dict(order)
    await notify_order(data)  # best-effort: falhas só vão para o log
    return {"ok": True, "order": data}


# ── Public ────────────────────────────────────────────────────────────────────

@public_orders_router.get("/api/public/{tenant_id}/orders")
async def find_public_orders(tenant_id: str, query: str = "", db: AsyncSession = Depends(get_db)):
    """Acompanhamento do cliente: por número do pedido ou por telefone. Sem busca, não lista nada."""
    query = query.strip()
    if not query:
        return _error(400, "missing_query")

    digits = re.sub(r"\D", "", query)
    stmt = select(Order).where(Order.tenant_id == tenant_id)
    if query.isdigit() and len(query) < 8:
        stmt = stmt.where(Order.id == int(query))
    elif len(digits) >= 8:
        stmt = stmt.where(func.regexp_replace(Order.phone, r"\D", "", "g").contains(digits))
    else:
        return {"orders": []}
    result = await db.execute(stmt.order_by(Order.sort_index))
    return {"orders": [_order_to_dict(o) for o in result.scalars().all()]}


@public_orders_router.post("/api/public/{tenant_id}/orders")
async def create_public_order(tenant_id: str, body: OrderIn, db: AsyncSession = Depends(get_db)):
    """Pedido feito pelo cliente no cardápio online. O id é gerado aqui e o status nasce Pendente."""
    body.id = 1  # só para passar na validação; o id real vem abaixo
    body.status = "Pendente"
    if not body.is_valid():
        return _error(400, "invalid_order_payload")

    # produtos sem ingrediente (em falta) não podem ser pedidos, mesmo com o cardápio aberto desatualizado
    blocked = await blocked_product_names(db, tenant_id)
    if blocked:
        ordered = [item for item in (body.items or []) if isinstance(item, str)]
        unavailable = [name for name in blocked if any(name in item for item in ordered)]
        if unavailable:
            return JSONResponse({"ok": False, "error": "product_unavailable", "products": unavailable}, status_code=409)

    # serializa a geração de id por tenant (evita dois pedidos com o mesmo número)
    await db.execute(text("select pg_advisory_xact_lock(hashtext(:tenant))"), {"tenant": tenant_id})
    next_id = (await db.execute(
        select(func.coalesce(func.max(Order.id), 0) + 1).where(Order.tenant_id == tenant_id)
    )).scalar_one()
    await db.execute(update(Order).where(Order.tenant_id == tenant_id).values(sort_index=Order.sort_index + 1))
    body.id = next_id
    await db.execute(insert(Order).values(**_order_values(body, tenant_id, 0)))
    await db.commit()

    created = body.model_dump(by_alias=True)
    await notify_order(created)
    await try_enqueue_print(created)
    return JSONResponse({"ok": True, "order": created}, status_code=201)
