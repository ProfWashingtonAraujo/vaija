import hashlib
import hmac
import time

from fastapi import APIRouter, HTTPException, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import Payment
from sqlalchemy import select
from services import notify_backend_order_paid
from config import get_settings
import json
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])

MP_SIGNATURE_TOLERANCE_SECONDS = 600


def verify_mercadopago_signature(request: Request, secret: str) -> bool:
    """Valida `x-signature` (HMAC-SHA256 de `id:<data.id>;request-id:<x-request-id>;ts:<ts>;`)."""
    if not secret:
        return False
    parts = dict(
        item.strip().split("=", 1)
        for item in request.headers.get("x-signature", "").split(",")
        if "=" in item
    )
    ts, received = parts.get("ts", ""), parts.get("v1", "")
    if not ts or not received:
        return False
    try:
        ts_seconds = int(ts) / 1000 if len(ts) > 11 else int(ts)
    except ValueError:
        return False
    if abs(time.time() - ts_seconds) > MP_SIGNATURE_TOLERANCE_SECONDS:
        return False

    data_id = request.query_params.get("data.id", "")
    if data_id.isalnum():
        data_id = data_id.lower()
    manifest = f"id:{data_id};request-id:{request.headers.get('x-request-id', '')};ts:{ts};"
    expected = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received)


@router.post("/mercadopago")
async def mercadopago_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    if not verify_mercadopago_signature(request, get_settings().mercado_pago_webhook_secret):
        logger.warning("Mercado Pago webhook rejeitado: assinatura inválida")
        raise HTTPException(status_code=401, detail="invalid_signature")
    body = await request.json()
    action = body.get("action")
    data = body.get("data", {})

    logger.info(f"Mercado Pago webhook: action={action}, data={data}")

    if action == "payment.created" or action == "payment.updated":
        payment_id = data.get("id")
        if not payment_id:
            return {"status": "error", "message": "No payment ID"}

        from gateway import MercadoPagoGateway
        mp = MercadoPagoGateway()
        try:
            mp_payment = await mp.get_payment(int(payment_id))
        except Exception as e:
            logger.error(f"Failed to fetch payment {payment_id}: {e}")
            return {"status": "error", "message": str(e)}

        external_ref = mp_payment.get("external_reference")
        if external_ref:
            result = await db.execute(select(Payment).where(Payment.id == int(external_ref)))
            payment = result.scalars().first()
            if payment:
                new_status = mp_payment.get("status", payment.status)
                status_map = {
                    "approved": "approved",
                    "pending": "pending",
                    "authorized": "approved",
                    "in_process": "pending",
                    "rejected": "rejected",
                    "cancelled": "cancelled",
                    "refunded": "refunded",
                    "charged_back": "refunded",
                }
                payment.status = status_map.get(new_status, new_status)
                payment.gateway_data = mp_payment

                if payment.status == "approved":
                    await notify_backend_order_paid(payment.order_id, payment.tenant_id)

                await db.flush()
                logger.info(f"Payment {payment.id} updated to {payment.status}")

    return {"status": "ok"}


@router.post("/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    import stripe

    secret = get_settings().stripe_webhook_secret
    if not secret:
        raise HTTPException(status_code=401, detail="invalid_signature")
    payload = await request.body()
    try:
        stripe.Webhook.construct_event(payload, request.headers.get("stripe-signature", ""), secret)
    except (ValueError, stripe.SignatureVerificationError):
        logger.warning("Stripe webhook rejeitado: assinatura inválida")
        raise HTTPException(status_code=401, detail="invalid_signature")
    body = json.loads(payload)
    event_type = body.get("type")
    data_object = body.get("data", {}).get("object", {})

    logger.info(f"Stripe webhook: type={event_type}")

    if event_type == "payment_intent.succeeded":
        payment_intent_id = data_object.get("id")
        order_id = data_object.get("metadata", {}).get("order_id")

        if order_id:
            result = await db.execute(select(Payment).where(Payment.gateway_id == payment_intent_id))
            payment = result.scalars().first()
            if payment:
                payment.status = "approved"
                payment.gateway_data = data_object
                await notify_backend_order_paid(payment.order_id, payment.tenant_id)
                await db.flush()

    elif event_type == "payment_intent.payment_failed":
        payment_intent_id = data_object.get("id")
        result = await db.execute(select(Payment).where(Payment.gateway_id == payment_intent_id))
        payment = result.scalars().first()
        if payment:
            payment.status = "rejected"
            payment.gateway_data = data_object
            await db.flush()

    return {"status": "ok"}
