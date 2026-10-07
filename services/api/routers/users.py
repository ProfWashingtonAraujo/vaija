from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import User
from schemas import CreateUserRequest, ChangePasswordRequest
from auth import CurrentAuth, hash_password, verify_password
from user_utils import (
    ROLE_LABELS, has_permission, is_unique_violation, is_valid_optional_email, is_valid_username,
    normalize_email, normalize_username, role_permissions, user_to_dict,
)

users_router = APIRouter(prefix="/api/users", tags=["users"])


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=status)


@users_router.get("")
async def get_users(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    if not has_permission(auth.role_key, "users:read"):
        return _error(403, "forbidden")
    result = await db.execute(select(User).where(User.tenant_id == auth.tenant_id).order_by(User.id))
    return {"ok": True, "users": [user_to_dict(u) for u in result.scalars().all()]}


@users_router.post("")
async def create_user(
    body: CreateUserRequest,
    auth: CurrentAuth,
    db: AsyncSession = Depends(get_db),
):
    if not has_permission(auth.role_key, "users:create"):
        return _error(403, "forbidden")
    username = normalize_username(body.username)
    email = normalize_email(body.email)
    if not (body.name and body.role_key and body.shift and username and body.password):
        return _error(400, "missing_user_fields")
    if not is_valid_username(username):
        return _error(400, "invalid_username")
    if not is_valid_optional_email(email):
        return _error(400, "invalid_email")
    role = ROLE_LABELS.get(body.role_key)
    if not role:
        return _error(400, "invalid_role")
    if len(body.password) < 6:
        return _error(400, "password_too_short")

    user = User(
        tenant_id=auth.tenant_id,
        name=body.name,
        role=role,
        role_key=body.role_key,
        shift=body.shift,
        username=username,
        email=email or None,
        password_hash=hash_password(body.password),
        permissions=[],
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError as e:
        if is_unique_violation(e):
            await db.rollback()
            return _error(400, "username_already_exists")
        raise
    data = user_to_dict(user)
    data["permissions"] = role_permissions(user.role_key)
    return JSONResponse({"ok": True, "user": data}, status_code=201)


@users_router.post("/change-password")
async def change_password(
    body: ChangePasswordRequest,
    auth: CurrentAuth,
    db: AsyncSession = Depends(get_db),
):
    if not body.current_password or not body.next_password:
        return _error(400, "missing_password_fields")
    if len(body.next_password) < 6:
        return _error(400, "password_too_short")
    result = await db.execute(
        select(User).where(User.id == auth.user_id, User.tenant_id == auth.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        return _error(400, "user_not_found")
    if not verify_password(body.current_password, user.password_hash):
        return _error(400, "invalid_current_password")
    user.password_hash = hash_password(body.next_password)
    return {"ok": True}
