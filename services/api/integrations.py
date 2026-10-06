"""Integrações de saída: fila de impressão (Redis) e webhook do n8n.

Ambas são best-effort: uma falha aqui nunca deve impedir a gravação do pedido.
Os pedidos chegam como dict em camelCase (o mesmo formato devolvido pela API).
"""
import json
import logging
import re
import time
from datetime import datetime, timezone
from itertools import count

import httpx
import redis.asyncio as redis

from config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

PRINT_QUEUE = "print-jobs"
_job_counter = count(1)
_redis: redis.Redis | None = None


def redis_client() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(settings.redis_url)
    return _redis


async def enqueue_print(order: dict) -> str:
    """Enfileira o cupom do pedido. Levanta exceção se o Redis estiver indisponível."""
    job_id = f"{int(time.time() * 1000)}-{next(_job_counter)}"
    payload = {
        "orderId": order.get("id"),
        "customer": order.get("customer", ""),
        "phone": order.get("phone", ""),
        "address": order.get("address", ""),
        "items": order.get("items"),
        "value": order.get("value", 0),
        "payment": order.get("payment", ""),
        "source": order.get("source") or "Online",
        "tableNumber": order.get("tableNumber"),
        "notes": order.get("notes") or "",
        "status": order.get("status", ""),
        "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    await redis_client().lpush(PRINT_QUEUE, json.dumps(payload))
    return job_id


async def try_enqueue_print(order: dict) -> None:
    try:
        await enqueue_print(order)
    except Exception as error:  # Redis fora do ar não pode derrubar o pedido
        logger.warning("fila de impressão indisponível para o pedido %s: %s", order.get("id"), error)


async def notify_order(order: dict) -> bool:
    """Dispara o webhook do n8n com o status do pedido. True se enviado (ou se não há webhook)."""
    url = settings.n8n_order_status_webhook_url
    if not url:
        return True
    items = order.get("items") if isinstance(order.get("items"), list) else []
    payload = {
        "orderId": order.get("id"),
        "customer": order.get("customer"),
        "phone": re.sub(r"\D", "", order.get("phone") or ""),
        "rawPhone": order.get("phone"),
        "status": order.get("status"),
        "items": [str(item) for item in items],
        "value": float(order.get("value") or 0),
        "payment": order.get("payment"),
        "time": order.get("time"),
        "elapsed": order.get("elapsed"),
    }
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.post(url, json=payload)
            return response.status_code < 300
    except Exception as error:
        logger.warning("webhook n8n falhou para o pedido %s: %s", order.get("id"), error)
        return False
