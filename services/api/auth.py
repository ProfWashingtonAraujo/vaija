"""
Autenticação: JWT, cookies HTTP-only, middleware, hashing — espelha auth.go.
"""
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated

from fastapi import Cookie, Depends, HTTPException, Request, Response
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from config import get_settings
from database import get_db
from models import AuthSession, User

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
settings = get_settings()

ACCESS_TOKEN_EXPIRE_MINUTES = 15
COOKIE_ACCESS = "vaija_access_token"
COOKIE_REFRESH = "vaija_refresh_token"


# ── Hashing ───────────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def _hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


# ── JWT ───────────────────────────────────────────────────────────────────────

def create_access_token(user_id: int, tenant_id: str, role_key: str = "") -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    return jwt.encode(
        {"sub": str(user_id), "tid": tenant_id, "rk": role_key, "exp": expire},
        settings.auth_jwt_secret,
        algorithm="HS256",
    )


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, settings.auth_jwt_secret, algorithms=["HS256"])
    except JWTError:
        raise HTTPException(status_code=401, detail="invalid_token")


# ── Cookies ───────────────────────────────────────────────────────────────────

def set_auth_cookies(response: Response, access: str, refresh: str) -> None:
    secure = settings.auth_cookie_secure
    same_site = settings.cookie_same_site

    # Sem max_age: são cookies de sessão e o navegador os descarta ao ser fechado.
    # A validade real continua limitada no servidor (JWT de 15 min e AUTH_REFRESH_DAYS no refresh).
    response.set_cookie(
        COOKIE_ACCESS, access,
        httponly=True, secure=secure, samesite=same_site,
    )
    response.set_cookie(
        COOKIE_REFRESH, refresh,
        httponly=True, secure=secure, samesite=same_site,
        path="/api/auth",
    )


def clear_auth_cookies(response: Response) -> None:
    response.delete_cookie(COOKIE_ACCESS, path="/")
    response.delete_cookie(COOKIE_REFRESH, path="/api/auth")


# ── Sessions ──────────────────────────────────────────────────────────────────

async def new_session(db: AsyncSession, user: User) -> tuple[str, str]:
    """Cria access + refresh token e persiste a sessão no banco."""
    access = create_access_token(user.id, user.tenant_id, user.role_key)

    raw_refresh = secrets.token_urlsafe(48)
    refresh_hash = _hash_token(raw_refresh)
    expires_at = datetime.now(timezone.utc) + timedelta(days=settings.auth_refresh_days)

    db.add(AuthSession(user_id=user.id, refresh_token_hash=refresh_hash, expires_at=expires_at))
    await db.flush()

    return access, raw_refresh


async def rotate_session(db: AsyncSession, raw_refresh: str) -> User:
    """Valida e rotaciona o refresh token. Retorna o usuário."""
    token_hash = _hash_token(raw_refresh)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(AuthSession).where(
            AuthSession.refresh_token_hash == token_hash,
            AuthSession.expires_at > now,
        )
    )
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=401, detail="invalid_refresh_token")

    user_result = await db.execute(select(User).where(User.id == session.user_id))
    user = user_result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="user_not_found")

    await db.delete(session)
    return user


async def delete_session(db: AsyncSession, raw_refresh: str) -> None:
    token_hash = _hash_token(raw_refresh)
    await db.execute(delete(AuthSession).where(AuthSession.refresh_token_hash == token_hash))


# ── Middleware / Dependency ───────────────────────────────────────────────────

class AuthContext:
    def __init__(self, user_id: int, tenant_id: str, role_key: str = ""):
        self.user_id = user_id
        self.tenant_id = tenant_id
        self.role_key = role_key

    @property
    def is_platform_admin(self) -> bool:
        return self.tenant_id == "admin" and self.role_key == "admin"


async def require_auth(
    request: Request,
    vaija_access_token: Annotated[str | None, Cookie()] = None,
) -> AuthContext:
    token = vaija_access_token
    if not token:
        # fallback: Bearer header
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            token = auth_header[7:]

    if not token:
        raise HTTPException(status_code=401, detail="missing_token")

    payload = decode_access_token(token)
    return AuthContext(
        user_id=int(payload["sub"]),
        tenant_id=payload.get("tid") or "default",
        role_key=payload.get("rk", ""),
    )


async def require_platform_admin(auth: AuthContext = Depends(require_auth)) -> AuthContext:
    if not auth.is_platform_admin:
        raise HTTPException(status_code=403, detail="forbidden")
    return auth


CurrentAuth = Annotated[AuthContext, Depends(require_auth)]
PlatformAdmin = Annotated[AuthContext, Depends(require_platform_admin)]
