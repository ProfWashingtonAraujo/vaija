import mercadopago
import httpx
from config import get_settings


class MercadoPagoGateway:
    def __init__(self):
        settings = get_settings()
        self.sdk = mercadopago.SDK(settings.mercado_pago_access_token)
        self.public_key = settings.mercado_pago_public_key

    async def create_pix_payment(self, amount: float, description: str, external_reference: str) -> dict:
        payment_data = {
            "transaction_amount": amount,
            "description": description,
            "external_reference": external_reference,
            "payment_method_id": "pix",
            "date_of_expiration": None,
        }
        result = self.sdk.payment().create(payment_data)
        payment = result["response"]
        return {
            "id": payment["id"],
            "status": payment["status"],
            "qr_code": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code"),
            "qr_code_base64": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("qr_code_base64"),
            "ticket_url": payment.get("point_of_interaction", {}).get("transaction_data", {}).get("ticket_url"),
        }

    async def create_card_payment(self, amount: float, description: str, external_reference: str, token: str, installments: int = 1) -> dict:
        payment_data = {
            "transaction_amount": amount,
            "description": description,
            "external_reference": external_reference,
            "token": token,
            "installments": installments,
            "payment_method_id": "visa",
        }
        result = self.sdk.payment().create(payment_data)
        payment = result["response"]
        return {
            "id": payment["id"],
            "status": payment["status"],
            "status_detail": payment.get("status_detail"),
        }

    async def create_boleto_payment(self, amount: float, description: str, external_reference: str, payer_email: str) -> dict:
        payment_data = {
            "transaction_amount": amount,
            "description": description,
            "external_reference": external_reference,
            "payment_method_id": "bolbradesco",
            "payer": {"email": payer_email},
        }
        result = self.sdk.payment().create(payment_data)
        payment = result["response"]
        return {
            "id": payment["id"],
            "status": payment["status"],
            "transaction_details": payment.get("transaction_details", {}),
        }

    async def get_payment(self, payment_id: int) -> dict:
        result = self.sdk.payment().get(payment_id)
        return result["response"]

    async def refund_payment(self, payment_id: int, amount: float | None = None) -> dict:
        if amount:
            result = self.sdk.payment().refund(payment_id, {"amount": amount})
        else:
            result = self.sdk.payment().refund(payment_id)
        return result["response"]

    def validate_webhook(self, headers: dict, body: bytes) -> bool:
        x_signature = headers.get("x-signature", "")
        x_request_id = headers.get("x-request-id", "")
        if not x_signature:
            return False
        return True


class StripeGateway:
    def __init__(self):
        import stripe
        settings = get_settings()
        stripe.api_key = settings.stripe_secret_key
        self.stripe = stripe

    async def create_pix_payment(self, amount: float, description: str, external_reference: str) -> dict:
        intent = self.stripe.PaymentIntent.create(
            amount=int(amount * 100),
            currency="brl",
            payment_method_types=["pix"],
            metadata={"order_id": external_reference},
        )
        return {
            "id": intent.id,
            "status": intent.status,
            "client_secret": intent.client_secret,
        }

    async def create_card_payment(self, amount: float, description: str, external_reference: str, token: str) -> dict:
        intent = self.stripe.PaymentIntent.create(
            amount=int(amount * 100),
            currency="brl",
            payment_method_types=["card"],
            metadata={"order_id": external_reference},
        )
        return {
            "id": intent.id,
            "status": intent.status,
            "client_secret": intent.client_secret,
        }

    async def get_payment(self, payment_id: str) -> dict:
        return self.stripe.PaymentIntent.retrieve(payment_id)

    async def refund_payment(self, payment_id: str) -> dict:
        return self.stripe.Refund.create(payment_intent=payment_id)
