"""
Schemas Pydantic v2 — request/response bodies e serialização de modelos.
Usa apenas model_config (não a classe Config legada).
"""
from typing import Any
from pydantic import BaseModel, ConfigDict, field_validator


def _camel(s: str) -> str:
    """snake_case → camelCase"""
    parts = s.split("_")
    return parts[0] + "".join(w.capitalize() for w in parts[1:])


_camel_config = ConfigDict(alias_generator=_camel, populate_by_name=True, from_attributes=True)


# ── Auth ──────────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    model_config = ConfigDict(alias_generator=_camel, populate_by_name=True)

    email: str = ""
    password: str = ""
    tenant_id: str | None = None


class UserOut(BaseModel):
    model_config = _camel_config

    id: int
    name: str
    role: str
    role_key: str
    shift: str
    email: str
    tenant_id: str
    is_platform_admin: bool = False
    permissions: list[str]


# ── Users ─────────────────────────────────────────────────────────────────────

class CreateUserRequest(BaseModel):
    model_config = ConfigDict(alias_generator=_camel, populate_by_name=True)

    name: str = ""
    role_key: str = ""
    shift: str = ""
    email: str = ""
    password: str = ""


class PlatformUserRequest(BaseModel):
    name: str = ""
    email: str = ""
    password: str = ""
    permissions: list[str] = []


class TenantUserRequest(BaseModel):
    model_config = ConfigDict(alias_generator=_camel, populate_by_name=True)

    tenant_id: str = ""
    name: str = ""
    email: str = ""
    password: str = ""
    role_key: str = ""
    shift: str = ""
    business_type: str = ""


class PrinterConfigUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=_camel, populate_by_name=True, extra="ignore")

    ip: str | None = None
    port: int | None = None
    model: str | None = None
    auto_print: bool | None = None
    print_logo: bool | None = None
    copies: int | None = None
    sound_enabled: bool | None = None


class ChangePasswordRequest(BaseModel):
    model_config = ConfigDict(alias_generator=_camel, populate_by_name=True)

    current_password: str = ""
    next_password: str = ""


# ── Categories ────────────────────────────────────────────────────────────────

class CategoryOut(BaseModel):
    model_config = _camel_config

    name: str
    menu_enabled: bool
    pos_enabled: bool


class CategoryIn(BaseModel):
    name: str
    menu_enabled: bool | None = None
    pos_enabled: bool | None = None
    # aceita camelCase do frontend
    menuEnabled: bool | None = None
    posEnabled: bool | None = None

    def resolved_menu(self) -> bool:
        return self.menu_enabled if self.menu_enabled is not None else (self.menuEnabled or False)

    def resolved_pos(self) -> bool:
        return self.pos_enabled if self.pos_enabled is not None else (self.posEnabled or False)


# ── Products ──────────────────────────────────────────────────────────────────

class SizePriceOut(BaseModel):
    size: str
    price: float


class ProductOut(BaseModel):
    model_config = _camel_config

    id: str
    name: str
    price: float
    category: str
    description: str
    image: str
    available: bool
    size_prices: list[SizePriceOut] = []


class ProductIn(BaseModel):
    id: str
    name: str
    price: float
    category: str
    description: str
    image: str
    available: bool = True
    size_prices: list[SizePriceOut] = []
    sizePrices: list[SizePriceOut] = []

    def resolved_size_prices(self) -> list[SizePriceOut]:
        return self.size_prices or self.sizePrices


# ── Orders ────────────────────────────────────────────────────────────────────

ALLOWED_STATUSES = {
    "Pendente", "Em preparo", "Em producao",
    "Saiu para entrega", "Entregue", "Cancelado", "Pronto para retirada",
}


class OrderOut(BaseModel):
    model_config = _camel_config

    id: int
    customer: str
    phone: str
    address: str
    items: Any
    elapsed: str
    value: float
    status: str
    payment: str
    time: str
    source: str = "Online"
    table_number: Any = None
    delivery_fee: float | None = None
    notes: str = ""


class OrderIn(BaseModel):
    id: int
    customer: str
    phone: str
    address: str = ""
    items: Any
    elapsed: str
    value: float
    status: str
    payment: str
    time: str
    source: str = "Online"
    table_number: Any = None
    delivery_fee: float | None = None
    notes: str = ""
    # camelCase aliases vindos do frontend
    tableNumber: Any = None
    deliveryFee: float | None = None

    def resolved_table_number(self) -> Any:
        return self.table_number if self.table_number is not None else self.tableNumber

    def resolved_delivery_fee(self) -> float | None:
        return self.delivery_fee if self.delivery_fee is not None else self.deliveryFee


class PublicOrderIn(BaseModel):
    customer: str
    phone: str
    address: str = ""
    items: Any
    value: float
    payment: str
    table_number: Any = None
    delivery_fee: float | None = None
    notes: str = ""
