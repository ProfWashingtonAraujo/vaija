from fastapi import FastAPI, HTTPException, Depends, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.ext.asyncio import AsyncSession
from database import get_db, init_db
from schemas import (
    CreatePaymentRequest,
    CreatePaymentResponse,
    PaymentResponse,
    RefundRequest,
    RefundResponse,
    FinancialSummary,
)
from services import (
    create_payment,
    get_payment_by_order,
    get_payment_by_id,
    get_payments_by_tenant,
    refund_payment,
    get_financial_summary,
)
from webhooks import router as webhooks_router
from config import get_settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Vaija Payments Service",
    description="Serviço de pagamentos para a plataforma Vaija",
    version="1.0.0",
)

settings = get_settings()
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins.split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(webhooks_router)


@app.on_event("startup")
async def startup():
    await init_db()
    logger.info("Payments service started")


@app.get("/health")
async def health():
    return {"status": "ok", "service": "payments"}


@app.post("/payments/create", response_model=CreatePaymentResponse)
async def create_new_payment(data: CreatePaymentRequest, db: AsyncSession = Depends(get_db)):
    if data.amount <= 0:
        raise HTTPException(status_code=400, detail="Valor deve ser maior que zero")

    payment = await create_payment(db, data)
    return payment


@app.get("/payments/{order_id}", response_model=PaymentResponse)
async def get_payment(order_id: int, db: AsyncSession = Depends(get_db)):
    payment = await get_payment_by_order(db, order_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado para este pedido")
    return payment


@app.get("/payments/by-id/{payment_id}", response_model=PaymentResponse)
async def get_payment_by_id_route(payment_id: int, db: AsyncSession = Depends(get_db)):
    payment = await get_payment_by_id(db, payment_id)
    if not payment:
        raise HTTPException(status_code=404, detail="Pagamento não encontrado")
    return payment


@app.get("/payments/tenant/{tenant_id}", response_model=list[PaymentResponse])
async def list_tenant_payments(
    tenant_id: str,
    limit: int = Query(default=50, le=200),
    db: AsyncSession = Depends(get_db),
):
    return await get_payments_by_tenant(db, tenant_id, limit)


@app.post("/payments/{payment_id}/refund", response_model=RefundResponse)
async def refund(
    payment_id: int,
    data: RefundRequest,
    db: AsyncSession = Depends(get_db),
):
    try:
        return await refund_payment(db, payment_id, data.reason)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/payments/financial/{tenant_id}", response_model=FinancialSummary)
async def financial_summary(tenant_id: str, db: AsyncSession = Depends(get_db)):
    return await get_financial_summary(db, tenant_id)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
