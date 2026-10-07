"""Autenticação do serviço de pagamentos.

Aceita duas credenciais:
- `X-Internal-API-Key`: chamadas serviço-a-serviço (acesso a qualquer tenant);
- JWT da API principal (cookie `vaija_access_token` ou `Authorization: Bearer`): acesso só ao próprio tenant.
"""
import secrets
from dataclasses import dataclass
from typing import Annotated

from fastapi import Depends, Header, HTTPException, Request
from jose import JWTError, jwt

from config import get_settings

COOKIE_ACCESS = "vaija_access_token"


@dataclass
class Caller:
    tenant_id: str | None  # None = chamada interna (qualquer tenant)
    internal: bool = False

    def ensure_tenant(self, tenant_id: str) -> None:
        if not self.internal and self.tenant_id != tenant_id:
            raise HTTPException(status_code=403, detail="forbidden")


async def require_caller(
    request: Request,
    x_internal_api_key: Annotated[str | None, Header()] = None,
) -> Caller:
    settings = get_settings()

    if x_internal_api_key:
        expected = settings.internal_api_key
        if expected and secrets.compare_digest(x_internal_api_key, expected):
            return Caller(tenant_id=None, internal=True)
        raise HTTPException(status_code=401, detail="invalid_internal_api_key")

    token = request.cookies.get(COOKIE_ACCESS)
    if not token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]
    if not token:
        raise HTTPException(status_code=401, detail="missing_token")

    try:
        payload = jwt.decode(token, settings.auth_jwt_secret, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="invalid_token")
    return Caller(tenant_id=payload.get("tid") or "default")


CurrentCaller = Annotated[Caller, Depends(require_caller)]
