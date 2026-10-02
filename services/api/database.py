from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import get_settings

database_url = get_settings().database_url
if database_url.startswith("postgresql://"):
    database_url = database_url.replace("postgresql://", "postgresql+asyncpg://", 1)

engine = create_async_engine(database_url, echo=False, pool_pre_ping=True)
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
