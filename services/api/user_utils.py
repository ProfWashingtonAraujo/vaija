"""Helpers compartilhados de usuário — espelham models.go/store.go do Go."""
import re

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


_USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,29}$")


def normalize_username(value: str | None) -> str:
    return (value or "").strip().lower()


def is_valid_username(value: str) -> bool:
    """3 a 30 caracteres: letras minúsculas, números, '.', '_' e '-' (sem espaços)."""
    return bool(_USERNAME_RE.match(value))


def normalize_email(value: str | None) -> str:
    return (value or "").strip().lower()


def is_valid_optional_email(value: str) -> bool:
    """E-mail é só contato: vazio vale; se preenchido, precisa ter '@'."""
    return not value or "@" in value


def username_from_email(email: str) -> str:
    """Sugere um usuário a partir do e-mail (parte antes do '@'), usado na migração."""
    base = re.sub(r"[^a-z0-9._-]+", ".", email.split("@")[0].strip().lower()).strip("._-")
    return (base or "usuario").ljust(3, "0")[:30]


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
        "username": user.username,
        "email": user.email or "",
        "tenantId": user.tenant_id,
        "permissions": permissions,
    }
    if platform:
        data["isPlatformAdmin"] = True
    return data


def is_unique_violation(error: IntegrityError) -> bool:
    return getattr(getattr(error, "orig", None), "sqlstate", None) == "23505" or "unique" in str(error.orig).lower()
