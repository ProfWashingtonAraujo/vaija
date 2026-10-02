"""Helpers compartilhados de usuário — espelham models.go/store.go do Go."""
from sqlalchemy.exc import IntegrityError

from models import User

PLATFORM_PERMISSIONS = ["saas:clients", "saas:billing", "saas:support", "saas:settings"]

ROLE_LABELS = {"admin": "Administrador", "manager": "Gerente", "operator": "Operador"}

_ROLE_PERMISSIONS = {
    "admin": ["users:read", "users:create", "users:update", "users:change-password", "catalog:write", "orders:write"],
    "manager": ["users:read", "users:change-password", "catalog:write", "orders:write"],
    "operator": ["users:change-password", "catalog:write", "orders:write"],
}

BUSINESS_CATEGORIES = {
    "pizzeria": ["Pizzas Tradicionais", "Pizzas Especiais", "Pizzas Doces", "Bordas", "Porções", "Bebidas", "Adicionais"],
    "hamburger": ["Hambúrgueres", "Combos", "Acompanhamentos", "Porções", "Sobremesas", "Bebidas", "Adicionais"],
    "restaurant": ["Entradas", "Pratos principais", "Pratos executivos", "Acompanhamentos", "Sobremesas", "Bebidas"],
    "confectionery": ["Bolos", "Doces", "Salgados", "Kits e caixas", "Sobremesas", "Bebidas"],
    "delivery": ["Combos", "Refeições", "Lanches", "Porções", "Sobremesas", "Bebidas", "Adicionais"],
}


def role_permissions(role_key: str) -> list[str]:
    return list(_ROLE_PERMISSIONS.get(role_key, []))


def has_permission(role_key: str, wanted: str) -> bool:
    return wanted in _ROLE_PERMISSIONS.get(role_key, [])


def is_platform_admin(user: User) -> bool:
    return user.tenant_id == "admin" and user.role_key == "admin"


def user_to_dict(user: User) -> dict:
    """Serializa como o Go (setUserPermissions): permissões vazias caem no padrão do papel."""
    platform = is_platform_admin(user)
    permissions = list(user.permissions or [])
    if not permissions:
        permissions = list(PLATFORM_PERMISSIONS) if platform else role_permissions(user.role_key)
    data = {
        "id": user.id,
        "name": user.name,
        "role": user.role,
        "roleKey": user.role_key,
        "shift": user.shift,
        "email": user.email,
        "tenantId": user.tenant_id,
        "permissions": permissions,
    }
    if platform:
        data["isPlatformAdmin"] = True
    return data


def is_unique_violation(error: IntegrityError) -> bool:
    return getattr(getattr(error, "orig", None), "sqlstate", None) == "23505" or "unique" in str(error.orig).lower()
