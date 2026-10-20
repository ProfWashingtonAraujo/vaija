from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase
from config import get_settings


def _engine_config(raw_url: str) -> tuple[URL, dict]:
    """Converte a DATABASE_URL (Render/Neon/local) para o formato do asyncpg.

    Mesma lógica de services/api/database.py: asyncpg não aceita ?sslmode=... nem
    ?channel_binding=...; o endpoint "-pooler" do Neon (PgBouncer em modo transação)
    exige o cache de prepared statements desligado.
    """
    url = make_url(raw_url)
    if url.drivername in ("postgres", "postgresql"):
        url = url.set(drivername="postgresql+asyncpg")
    query = dict(url.query)
    sslmode = query.pop("sslmode", None)
    query.pop("channel_binding", None)
    connect_args: dict = {}
    host = url.host or ""
    if sslmode in ("require", "verify-ca", "verify-full") or host.endswith(".neon.tech"):
        connect_args["ssl"] = "require"
    if "-pooler" in host:
        connect_args["statement_cache_size"] = 0
    return url.set(query=query), connect_args


_url, _connect_args = _engine_config(get_settings().database_url)
engine = create_async_engine(_url, echo=False, connect_args=_connect_args)
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
    from models import Payment  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
