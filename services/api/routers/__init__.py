# routers/__init__.py — exporta todos os routers
from .auth import auth_router
from .catalog import catalog_router, public_catalog_router
from .orders import orders_router, public_orders_router
from .users import users_router
from .platform import platform_router
from .printer import printer_router
from .cash_register import cash_register_router, public_cash_register_router

__all__ = [
    "auth_router",
    "catalog_router",
    "public_catalog_router",
    "orders_router",
    "public_orders_router",
    "users_router",
    "platform_router",
    "printer_router",
    "cash_register_router",
    "public_cash_register_router",
]
