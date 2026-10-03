from sqlalchemy import text
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import get_settings


def _engine_config(raw_url: str) -> tuple[URL, dict]:
    """Converte a DATABASE_URL (Render/Supabase/local) para o formato do asyncpg.

    asyncpg não aceita ?sslmode=...; traduzimos para connect_args["ssl"]. Hosts do
    Supabase exigem TLS mesmo sem o parâmetro.
    """
    url = make_url(raw_url)
    if url.drivername in ("postgres", "postgresql"):
        url = url.set(drivername="postgresql+asyncpg")
    query = dict(url.query)
    sslmode = query.pop("sslmode", None)
    connect_args: dict = {}
    host = url.host or ""
    if sslmode in ("require", "verify-ca", "verify-full") or host.endswith((".supabase.com", ".supabase.co")):
        connect_args["ssl"] = "require"
    return url.set(query=query), connect_args


_url, _connect_args = _engine_config(get_settings().database_url)
engine = create_async_engine(_url, echo=False, pool_pre_ping=True, connect_args=_connect_args)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


async def init_db():
    """Cria tabelas que ainda não existem (idempotente)."""
    from models import User, AuthSession, Category, Product, Order  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # No Supabase, tabelas do schema public ficam expostas pela Data API (anon key).
        # RLS ligado e sem policies bloqueia esse acesso; a conexão direta do backend
        # (dono das tabelas) não é afetada.
        for table in Base.metadata.tables:
            await conn.execute(text(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY'))


async def ensure_bootstrap_admin(email: str, password: str) -> bool:
    """Cria o primeiro admin da plataforma se ainda não existir nenhum. Retorna True se criou."""
    if not email or not password:
        return False
    from sqlalchemy import select
    from auth import hash_password
    from models import User
    from user_utils import PLATFORM_PERMISSIONS

    async with async_session() as session:
        exists = await session.execute(
            select(User.id).where(User.tenant_id == "admin", User.role_key == "admin").limit(1)
        )
        if exists.first():
            return False
        session.add(User(
            tenant_id="admin", name="Administrador SaaS", role="Administrador SaaS", role_key="admin",
            shift="Administracao Vaija", email=email.strip().lower(),
            password_hash=hash_password(password), permissions=list(PLATFORM_PERMISSIONS),
        ))
        await session.commit()
        return True
