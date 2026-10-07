"""Rotas da plataforma SaaS (tenant 'admin') — espelham getPlatformUsers…deleteTenantUser do Go."""
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from auth import PlatformAdmin, hash_password
from database import get_db
from models import Category, User
from schemas import PlatformUserRequest, TenantUserRequest
from user_utils import (
    BUSINESS_CATEGORIES, PLATFORM_PERMISSIONS, ROLE_LABELS,
    is_unique_violation, is_valid_optional_email, is_valid_username,
    normalize_email, normalize_username, role_permissions, user_to_dict,
)

platform_router = APIRouter(prefix="/api/platform", tags=["platform"])


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=status)


def _valid_permissions(values: list[str]) -> bool:
    return all(p in PLATFORM_PERMISSIONS for p in values)


async def _flush_unique(db: AsyncSession) -> JSONResponse | None:
    """Faz flush; devolve a resposta de erro se houver violação de unicidade (usuário)."""
    try:
        await db.flush()
    except IntegrityError as e:
        await db.rollback()
        if is_unique_violation(e):
            return _error(400, "username_already_exists")
        raise
    return None


# ── Usuários da plataforma ────────────────────────────────────────────────────

@platform_router.get("/users")
async def get_platform_users(_: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.tenant_id == "admin").order_by(User.id))
    return {"ok": True, "users": [user_to_dict(u) for u in result.scalars().all()]}


@platform_router.post("/users")
async def create_platform_user(body: PlatformUserRequest, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    name = body.name.strip()
    username = normalize_username(body.username)
    email = normalize_email(body.email)
    if (
        not name or not is_valid_username(username) or not is_valid_optional_email(email)
        or len(body.password) < 8 or not _valid_permissions(body.permissions)
    ):
        return _error(400, "invalid_platform_user")

    user = User(
        tenant_id="admin", name=name, username=username, email=email or None,
        role="Administrador SaaS", role_key="admin", shift="Administracao Vaija",
        password_hash=hash_password(body.password), permissions=body.permissions,
    )
    db.add(user)
    if (error := await _flush_unique(db)):
        return error
    return JSONResponse({"ok": True, "user": user_to_dict(user)}, status_code=201)


@platform_router.put("/users/{user_id}")
async def update_platform_user(user_id: int, body: PlatformUserRequest, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    name = body.name.strip()
    username = normalize_username(body.username)
    email = normalize_email(body.email)
    if (
        not name or not is_valid_username(username) or not is_valid_optional_email(email)
        or (body.password and len(body.password) < 8) or not _valid_permissions(body.permissions)
    ):
        return _error(400, "invalid_platform_user")

    result = await db.execute(select(User).where(User.id == user_id, User.tenant_id == "admin"))
    user = result.scalar_one_or_none()
    if not user:
        return _error(404, "user_not_found")
    user.name, user.username, user.permissions = name, username, body.permissions
    if body.email is not None:
        user.email = email or None
    if body.password:
        user.password_hash = hash_password(body.password)
    if (error := await _flush_unique(db)):
        return error
    return {"ok": True, "user": user_to_dict(user)}


# ── Acessos de clientes (usuários dos tenants) ────────────────────────────────

@platform_router.get("/accesses")
async def get_tenant_users(_: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.tenant_id != "admin").order_by(User.tenant_id, User.id))
    return {"ok": True, "users": [user_to_dict(u) for u in result.scalars().all()]}


@platform_router.post("/accesses")
async def create_tenant_user(body: TenantUserRequest, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    tenant_id = body.tenant_id.strip()
    name = body.name.strip()
    username = normalize_username(body.username)
    email = normalize_email(body.email)
    shift = body.shift.strip()
    role = ROLE_LABELS.get(body.role_key)
    categories = BUSINESS_CATEGORIES.get(body.business_type.strip())
    if (
        not tenant_id or tenant_id == "admin" or not name
        or not is_valid_username(username) or not is_valid_optional_email(email)
        or len(body.password) < 8 or not shift or not role
        or (body.role_key == "admin" and categories is None)
    ):
        return _error(400, "invalid_tenant_user")

    user = User(
        tenant_id=tenant_id, name=name, username=username, email=email or None,
        role=role, role_key=body.role_key,
        shift=shift, password_hash=hash_password(body.password), permissions=[],
    )
    db.add(user)
    if (error := await _flush_unique(db)):
        return error
    if body.role_key == "admin":
        # Provisiona o catálogo inicial do tenant (ignora categorias já existentes).
        existing = await db.execute(select(Category.name).where(Category.tenant_id == tenant_id))
        taken = set(existing.scalars().all())
        for i, cat_name in enumerate(categories):
            if cat_name not in taken:
                db.add(Category(name=cat_name, tenant_id=tenant_id, menu_enabled=True, pos_enabled=True, sort_index=i))
    data = user_to_dict(user)
    data["permissions"] = role_permissions(user.role_key)
    return JSONResponse({"ok": True, "user": data}, status_code=201)


@platform_router.put("/accesses/{user_id}")
async def update_tenant_user(user_id: int, body: TenantUserRequest, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    name = body.name.strip()
    username = normalize_username(body.username)
    email = normalize_email(body.email)
    shift = body.shift.strip()
    role = ROLE_LABELS.get(body.role_key)
    if (
        not name or not is_valid_username(username) or not is_valid_optional_email(email)
        or (body.password and len(body.password) < 8) or not shift or not role
    ):
        return _error(400, "invalid_tenant_user")

    result = await db.execute(select(User).where(User.id == user_id, User.tenant_id != "admin"))
    user = result.scalar_one_or_none()
    if not user:
        return _error(404, "user_not_found")
    user.name, user.username, user.role, user.role_key, user.shift = name, username, role, body.role_key, shift
    if body.email is not None:
        user.email = email or None
    user.permissions = []
    if body.password:
        user.password_hash = hash_password(body.password)
    if (error := await _flush_unique(db)):
        return error
    return {"ok": True, "user": user_to_dict(user)}


@platform_router.delete("/accesses/{user_id}")
async def delete_tenant_user(user_id: int, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.id == user_id, User.tenant_id != "admin"))
    user = result.scalar_one_or_none()
    if not user:
        return _error(404, "user_not_found")
    await db.delete(user)
    return {"ok": True}
