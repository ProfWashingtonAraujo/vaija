import logging

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


logger = logging.getLogger(__name__)

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
    from models import User, AuthSession, Category, Product, IngredientStock, Order, CashRegister, RestaurantSettings, Delivery  # noqa: F401
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        # create_all não altera tabelas existentes: colunas novas entram aqui.
        await conn.execute(text("ALTER TABLE products ADD COLUMN IF NOT EXISTS ingredients JSONB NOT NULL DEFAULT '[]'::jsonb"))
        await conn.execute(text("ALTER TABLE ingredient_stock ADD COLUMN IF NOT EXISTS name TEXT"))
        await _migrate_users_to_username(conn)
        # No Supabase, tabelas do schema public ficam expostas pela Data API (anon key).
        # RLS ligado e sem policies bloqueia esse acesso; a conexão direta do backend
        # (dono das tabelas) não é afetada.
        for table in Base.metadata.tables:
            await conn.execute(text(f'ALTER TABLE "{table}" ENABLE ROW LEVEL SECURITY'))


async def _migrate_users_to_username(conn) -> None:
    """Login por usuário (único no sistema) em vez de e-mail; o e-mail vira contato opcional.

    Idempotente. Usuários existentes recebem como username a parte do e-mail antes do '@'
    (com sufixo numérico se houver conflito; o admin da plataforma tem prioridade).
    """
    from user_utils import username_from_email

    await conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT"))
    await conn.execute(text("ALTER TABLE users ALTER COLUMN email DROP NOT NULL"))
    # O e-mail deixa de ser único (vários usuários podem ficar sem e-mail).
    await conn.execute(text("ALTER TABLE users DROP CONSTRAINT IF EXISTS users_tenant_email_idx"))
    await conn.execute(text("DROP INDEX IF EXISTS users_tenant_email_idx"))

    pending = (await conn.execute(text(
        "SELECT id, email FROM users WHERE username IS NULL ORDER BY (tenant_id = 'admin') DESC, id"
    ))).all()
    if pending:
        taken = {row[0] for row in await conn.execute(text("SELECT lower(username) FROM users WHERE username IS NOT NULL"))}
        for user_id, email in pending:
            base = username_from_email(email or "")
            username, n = base, 1
            while username in taken:
                n += 1
                username = f"{base[:30 - len(str(n))]}{n}"
            taken.add(username)
            await conn.execute(
                text("UPDATE users SET username = :username WHERE id = :id"),
                {"username": username, "id": user_id},
            )
            logger.info("Usuário %s migrado para login '%s' (e-mail: %s).", user_id, username, email)

    await conn.execute(text("ALTER TABLE users ALTER COLUMN username SET NOT NULL"))
    await conn.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS users_username_idx ON users (username)"))


async def ensure_bootstrap_admin(username: str, password: str) -> bool:
    """Cria o primeiro admin da plataforma se ainda não existir nenhum. Retorna True se criou."""
    from user_utils import is_valid_username, normalize_username

    username = normalize_username(username)
    if not username or not password:
        return False
    if not is_valid_username(username):
        logger.warning("BOOTSTRAP_ADMIN_USERNAME inválido (use 3-30 caracteres: a-z, 0-9, '.', '_' ou '-') — ignorando.")
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
            shift="Administracao Vaija", username=username,
            password_hash=hash_password(password), permissions=list(PLATFORM_PERMISSIONS),
        ))
        await session.commit()
        return True
