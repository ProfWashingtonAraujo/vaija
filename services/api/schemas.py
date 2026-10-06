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
    """Aceita camelCase (frontend) e snake_case. Flags ausentes invalidam o payload (como no Go)."""
    model_config = ConfigDict(alias_generator=_camel, populate_by_name=True, extra="ignore")

    name: str = ""
    menu_enabled: bool | None = None
    pos_enabled: bool | None = None

    def is_valid(self) -> bool:
        return bool(self.name) and self.menu_enabled is not None and self.pos_enabled is not None


class CategoriesPayload(BaseModel):
    categories: list[CategoryIn] | None = None


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
    model_config = ConfigDict(alias_generator=_camel, populate_by_name=True, extra="ignore")

    id: str = ""
    name: str = ""
    price: float = 0
    category: str = ""
    description: str = ""
    image: str = ""
    available: bool = True
    size_prices: list[SizePriceOut] = []
    ingredients: list[str] = []

    def is_valid(self) -> bool:
        return (
            all([self.id, self.name, self.category, self.description, self.image])
            and 0 <= self.price < float("inf")
        )


class ProductsPayload(BaseModel):
    products: list[ProductIn] | None = None


class IngredientMissingUpdate(BaseModel):
    name: str = ""
    missing: bool = False


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
    """Pedido como o frontend envia (camelCase). Campos ausentes viram vazio e falham em is_valid()."""
    model_config = ConfigDict(alias_generator=_camel, populate_by_name=True, extra="ignore")

    id: int = 0
    customer: str = ""
    phone: str = ""
    address: str = ""
    items: Any = None
    elapsed: str = ""
    value: float = 0
    status: str = ""
    payment: str = ""
    time: str = ""
    source: str = "Online"
    table_number: Any = None
    delivery_fee: float | None = None
    notes: str | None = None

    def is_valid(self) -> bool:
        return (
            self.id != 0
            and all([self.customer, self.phone, self.elapsed, self.payment, self.time])
            and self.status in ALLOWED_STATUSES
            and isinstance(self.items, list)
        )


class OrdersPayload(BaseModel):
    orders: list[OrderIn] | None = None


class OrderStatusUpdate(BaseModel):
    model_config = ConfigDict(alias_generator=_camel, populate_by_name=True, extra="ignore")

    status: str = ""
    tenant_id: str = ""
