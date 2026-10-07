"""Routers: auth, catalog, orders, users, printer — um arquivo por domínio."""

# ── Auth ──────────────────────────────────────────────────────────────────────
from fastapi import APIRouter, HTTPException, Request, Response, Cookie
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from fastapi import Depends
from typing import Annotated

from database import get_db
from models import User
from schemas import LoginRequest, UserOut
from user_utils import normalize_username, user_to_dict
from auth import (
    verify_password, new_session, rotate_session, delete_session,
    set_auth_cookies, clear_auth_cookies, require_auth, CurrentAuth,
)

auth_router = APIRouter(prefix="/api/auth", tags=["auth"])


def _to_user_out(user: User) -> UserOut:
    return UserOut(
        id=user.id,
        name=user.name,
        role=user.role,
        role_key=user.role_key,
        shift=user.shift,
        username=user.username,
        email=user.email or "",
        tenant_id=user.tenant_id,
        is_platform_admin=(user.tenant_id == "admin" and user.role_key == "admin"),
        permissions=user_to_dict(user)["permissions"],
    )


@auth_router.post("/login")
async def login(
    body: LoginRequest,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
):
    username = normalize_username(body.username)
    if not username or not body.password:
        raise HTTPException(status_code=400, detail="missing_credentials")
    tenant_id = request.headers.get("X-Tenant-Id") or body.tenant_id or ""

    if tenant_id:
        result = await db.execute(
            select(User).where(func.lower(User.username) == username, User.tenant_id == tenant_id)
        )
    else:
        result = await db.execute(select(User).where(func.lower(User.username) == username))

    matches = result.scalars().all()
    user = matches[0] if len(matches) == 1 else None
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="invalid_credentials")

    access, refresh = await new_session(db, user)
    set_auth_cookies(response, access, refresh)
    return {"ok": True, "user": _to_user_out(user), "tenantId": user.tenant_id}


@auth_router.post("/refresh")
async def refresh(
    response: Response,
    db: AsyncSession = Depends(get_db),
    vaija_refresh_token: Annotated[str | None, Cookie()] = None,
):
    if not vaija_refresh_token:
        raise HTTPException(status_code=401, detail="missing_refresh_token")
    user = await rotate_session(db, vaija_refresh_token)
    access, new_refresh = await new_session(db, user)
    set_auth_cookies(response, access, new_refresh)
    return {"ok": True, "user": _to_user_out(user), "tenantId": user.tenant_id}


@auth_router.post("/logout")
async def logout(
    response: Response,
    db: AsyncSession = Depends(get_db),
    vaija_refresh_token: Annotated[str | None, Cookie()] = None,
):
    if vaija_refresh_token:
        await delete_session(db, vaija_refresh_token)
    clear_auth_cookies(response)
    return {"ok": True}


@auth_router.get("/me")
async def me(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(User).where(User.id == auth.user_id, User.tenant_id == auth.tenant_id)
    )
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="user_not_found")
    return {"ok": True, "user": _to_user_out(user), "tenantId": auth.tenant_id}
