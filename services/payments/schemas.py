from datetime import datetime
from pydantic import BaseModel
from typing import Literal


class CreatePaymentRequest(BaseModel):
    order_id: int
    tenant_id: str
    amount: float
    method: Literal["pix", "card", "boleto"]
    description: str | None = None


class CreatePaymentResponse(BaseModel):
    id: int
    order_id: int
    status: str
    method: str
    amount: float
    payment_url: str | None = None
    qr_code: str | None = None
    qr_code_base64: str | None = None


class PaymentResponse(BaseModel):
    id: int
    order_id: int
    tenant_id: str
    amount: float
    method: str
    status: str
    gateway: str
    gateway_id: str | None = None
    description: str | None = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class RefundRequest(BaseModel):
    reason: str | None = None


class RefundResponse(BaseModel):
    id: int
    status: str
    message: str


class FinancialSummary(BaseModel):
    tenant_id: str
    total_revenue: float
    total_payments: int
    approved: int
    pending: int
    rejected: int
    refunded: int
    by_method: dict[str, float]
