from fastapi import APIRouter, Request, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db
from models import Payment
from sqlalchemy import select
from services import notify_backend_order_paid
import logging

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/mercadopago")
async def mercadopago_webhook(request: Request, db: AsyncSession = Depends(get_db)):
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
                    await notify_backend_order_paid(payment.order_id)

                await db.flush()
                logger.info(f"Payment {payment.id} updated to {payment.status}")

    return {"status": "ok"}


@router.post("/stripe")
async def stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.json()
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
                await notify_backend_order_paid(payment.order_id)
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
