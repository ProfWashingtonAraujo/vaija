"""Impressora térmica: config em memória + fila de jobs no Redis ('print-jobs'), como no Go."""
import json
import time
from datetime import datetime, timezone
from itertools import count

import redis.asyncio as redis
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from auth import CurrentAuth
from config import get_settings
from schemas import PrinterConfigUpdate

printer_router = APIRouter(prefix="/api/printer", tags=["printer"])

_settings = get_settings()
_job_counter = count(1)
_redis: redis.Redis | None = None

_config = {
    "ip": _settings.printer_ip,
    "port": _settings.printer_port,
    "model": _settings.printer_model,
    "autoPrint": True,
    "printLogo": True,
    "copies": _settings.print_copies,
    "soundEnabled": True,
}


def _client() -> redis.Redis:
    global _redis
    if _redis is None:
        _redis = redis.from_url(_settings.redis_url)
    return _redis


async def _enqueue(order: dict) -> str:
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
        "notes": order.get("notes", ""),
        "status": order.get("status", ""),
        "createdAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    await _client().lpush("print-jobs", json.dumps(payload))
    return job_id


@printer_router.get("/config")
async def get_config(_: CurrentAuth):
    return _config


@printer_router.put("/config")
async def put_config(body: PrinterConfigUpdate, _: CurrentAuth):
    updates = {
        "ip": body.ip, "port": body.port, "model": body.model, "autoPrint": body.auto_print,
        "printLogo": body.print_logo, "copies": body.copies, "soundEnabled": body.sound_enabled,
    }
    _config.update({k: v for k, v in updates.items() if v is not None})
    return _config


@printer_router.post("/test")
async def test_printer(_: CurrentAuth):
    order = {
        "id": 9999, "customer": "TESTE DE IMPRESSAO", "phone": "(11) 99999-9999",
        "address": "Rua de Teste, 123", "items": ["1x Pizza Margherita", "1x Coca-Cola 2L"],
        "value": 45.90, "payment": "Pix", "source": "Teste", "notes": "Este e um cupom de teste",
    }
    try:
        job_id = await _enqueue(order)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
    return {"success": True, "jobId": job_id, "message": "Job de teste adicionado a fila"}


@printer_router.get("/status")
async def printer_status(_: CurrentAuth):
    try:
        waiting = await _client().llen("print-jobs")
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
    return {
        "printer": {"ip": _config["ip"], "port": _config["port"], "model": _config["model"]},
        "queue": {"waiting": waiting, "active": 0, "completed": 0, "failed": 0},
    }


@printer_router.post("/print-order")
async def print_order(order: dict, _: CurrentAuth):
    if not order.get("id") or not order.get("items"):
        return JSONResponse({"error": "Dados do pedido incompletos"}, status_code=400)
    try:
        job_id = await _enqueue(order)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
    return {"success": True, "jobId": job_id}
