"""Cliente mínimo da API do Asaas para a mensalidade do Vaija."""
import httpx

from config import get_settings


class AsaasError(Exception):
    def __init__(self, code: str, detail: str = ""):
        super().__init__(detail or code)
        self.code = code


async def _request(method: str, path: str, json: dict | None = None) -> dict:
    settings = get_settings()
    if not settings.asaas_api_key:
        raise AsaasError("billing_not_configured")
    try:
        async with httpx.AsyncClient(base_url=settings.asaas_base_url, timeout=20) as client:
            response = await client.request(
                method, path, json=json,
                headers={"access_token": settings.asaas_api_key, "User-Agent": "Vaija"},
            )
    except httpx.HTTPError as exc:
        raise AsaasError("gateway_unavailable", str(exc)) from exc
    if response.status_code >= 400:
        raise AsaasError("gateway_rejected", response.text[:500])
    return response.json()


async def create_customer(name: str, email: str, cpf_cnpj: str, tenant_id: str) -> dict:
    return await _request("POST", "/customers", {
        "name": name, "email": email, "cpfCnpj": cpf_cnpj,
        "externalReference": tenant_id, "notificationDisabled": False,
    })


async def create_subscription(customer_id: str, billing_type: str, value: float, next_due_date: str, plan: str, tenant_id: str) -> dict:
    return await _request("POST", "/subscriptions", {
        "customer": customer_id, "billingType": billing_type, "value": value,
        "nextDueDate": next_due_date, "cycle": "MONTHLY",
        "description": f"Vaija - Plano {plan}", "externalReference": tenant_id,
    })


async def update_subscription(subscription_id: str, billing_type: str, value: float, plan: str) -> dict:
    return await _request("PUT", f"/subscriptions/{subscription_id}", {
        "billingType": billing_type, "value": value, "updatePendingPayments": True,
        "description": f"Vaija - Plano {plan}",
    })


async def cancel_subscription(subscription_id: str) -> dict:
    return await _request("DELETE", f"/subscriptions/{subscription_id}")


async def list_subscription_payments(subscription_id: str) -> list[dict]:
    data = await _request("GET", f"/subscriptions/{subscription_id}/payments")
    return data.get("data", [])
