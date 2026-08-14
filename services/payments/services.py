from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from models import Payment
from schemas import CreatePaymentRequest, CreatePaymentResponse, RefundResponse, FinancialSummary
from gateway import MercadoPagoGateway, StripeGateway
import httpx


mp_gateway = MercadoPagoGateway()
stripe_gateway = StripeGateway()


async def create_payment(db: AsyncSession, data: CreatePaymentRequest) -> CreatePaymentResponse:
    description = data.description or f"Pedido #{data.order_id}"

    payment = Payment(
        order_id=data.order_id,
        tenant_id=data.tenant_id,
        amount=data.amount,
        method=data.method,
        status="pending",
        gateway="mercadopago",
        description=description,
    )
    db.add(payment)
    await db.flush()

    gateway_response = {}
    payment_url = None
    qr_code = None
    qr_code_base64 = None

    try:
        if data.method == "pix":
            gateway_response = await mp_gateway.create_pix_payment(
                amount=data.amount,
                description=description,
                external_reference=str(payment.id),
            )
            payment.gateway_id = str(gateway_response.get("id"))
            payment.gateway_data = gateway_response
            payment.status = gateway_response.get("status", "pending")
            qr_code = gateway_response.get("qr_code")
            qr_code_base64 = gateway_response.get("qr_code_base64")
            payment_url = gateway_response.get("ticket_url")

        elif data.method == "boleto":
            gateway_response = await mp_gateway.create_boleto_payment(
                amount=data.amount,
                description=description,
                external_reference=str(payment.id),
                payer_email="customer@example.com",
            )
            payment.gateway_id = str(gateway_response.get("id"))
            payment.gateway_data = gateway_response
            payment.status = gateway_response.get("status", "pending")

        elif data.method == "card":
            payment.status = "awaiting_token"

    except Exception as e:
        payment.status = "error"
        payment.gateway_data = {"error": str(e)}

    await db.flush()

    return CreatePaymentResponse(
        id=payment.id,
        order_id=payment.order_id,
        status=payment.status,
        method=payment.method,
        amount=float(payment.amount),
        payment_url=payment_url,
        qr_code=qr_code,
        qr_code_base64=qr_code_base64,
    )


async def get_payment_by_order(db: AsyncSession, order_id: int) -> Payment | None:
    result = await db.execute(select(Payment).where(Payment.order_id == order_id).order_by(Payment.created_at.desc()))
    return result.scalars().first()


async def get_payment_by_id(db: AsyncSession, payment_id: int) -> Payment | None:
    result = await db.execute(select(Payment).where(Payment.id == payment_id))
    return result.scalars().first()


async def get_payments_by_tenant(db: AsyncSession, tenant_id: str, limit: int = 50) -> list[Payment]:
    result = await db.execute(
        select(Payment).where(Payment.tenant_id == tenant_id).order_by(Payment.created_at.desc()).limit(limit)
    )
    return list(result.scalars().all())


async def refund_payment(db: AsyncSession, payment_id: int, reason: str | None = None) -> RefundResponse:
    payment = await get_payment_by_id(db, payment_id)
    if not payment:
        raise ValueError("Pagamento não encontrado")

    if payment.status != "approved":
        raise ValueError("Apenas pagamentos aprovados podem ser reembolsados")

    try:
        if payment.gateway == "mercadopago" and payment.gateway_id:
            await mp_gateway.refund_payment(int(payment.gateway_id))
        elif payment.gateway == "stripe" and payment.gateway_id:
            await stripe_gateway.refund_payment(payment.gateway_id)

        payment.status = "refunded"
        payment.description = f"{payment.description or ''} | Reembolso: {reason or 'Sem motivo informado'}"
        await db.flush()

        return RefundResponse(id=payment.id, status="refunded", message="Reembolso processado com sucesso")
    except Exception as e:
        raise ValueError(f"Erro ao processar reembolso: {str(e)}")


async def get_financial_summary(db: AsyncSession, tenant_id: str) -> FinancialSummary:
    result = await db.execute(select(Payment).where(Payment.tenant_id == tenant_id))
    payments = list(result.scalars().all())

    approved = [p for p in payments if p.status == "approved"]
    pending = [p for p in payments if p.status == "pending"]
    rejected = [p for p in payments if p.status == "rejected"]
    refunded = [p for p in payments if p.status == "refunded"]

    total_revenue = sum(float(p.amount) for p in approved)
    by_method: dict[str, float] = {}
    for p in approved:
        by_method[p.method] = by_method.get(p.method, 0) + float(p.amount)

    return FinancialSummary(
        tenant_id=tenant_id,
        total_revenue=total_revenue,
        total_payments=len(payments),
        approved=len(approved),
        pending=len(pending),
        rejected=len(rejected),
        refunded=len(refunded),
        by_method=by_method,
    )


async def notify_backend_order_paid(order_id: int, tenant_id: str) -> bool:
    from config import get_settings
    settings = get_settings()
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.put(
                f"{settings.backend_internal_url}/api/orders/{order_id}/status",
                json={"status": "Em preparo", "tenantId": tenant_id},
                headers={"X-Internal-API-Key": settings.internal_api_key},
                timeout=5.0,
            )
            return resp.status_code == 200
    except Exception:
        return False
