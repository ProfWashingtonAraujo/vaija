"""Impressora térmica: config em memória + fila de jobs no Redis ('print-jobs'), como no Go."""
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from auth import CurrentAuth
from config import get_settings
from integrations import PRINT_QUEUE, enqueue_print, redis_client
from schemas import PrinterConfigUpdate

printer_router = APIRouter(prefix="/api/printer", tags=["printer"])

_settings = get_settings()

_config = {
    "ip": _settings.printer_ip,
    "port": _settings.printer_port,
    "model": _settings.printer_model,
    "autoPrint": True,
    "printLogo": True,
    "copies": _settings.print_copies,
    "soundEnabled": True,
}


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
        job_id = await enqueue_print(order)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
    return {"success": True, "jobId": job_id, "message": "Job de teste adicionado a fila"}


@printer_router.get("/status")
async def printer_status(_: CurrentAuth):
    try:
        waiting = await redis_client().llen(PRINT_QUEUE)
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
        job_id = await enqueue_print(order)
    except Exception as e:
        return JSONResponse({"success": False, "error": str(e)}, status_code=500)
    return {"success": True, "jobId": job_id}
