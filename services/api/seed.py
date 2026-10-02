"""
Seed script — cria as tabelas e popula o banco com dados iniciais.
Executa uma vez; idempotente (não duplica se já existir).
"""
import asyncio
import json
from passlib.context import CryptContext
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy import text, select

DATABASE_URL = "postgresql+asyncpg://postgres:postgres@localhost:5434/vaija"

engine = create_async_engine(DATABASE_URL, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
pwd = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def create_tables(conn):
    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS users (
            id BIGSERIAL PRIMARY KEY,
            tenant_id TEXT NOT NULL DEFAULT 'default',
            name TEXT NOT NULL,
            role TEXT NOT NULL,
            role_key TEXT NOT NULL DEFAULT 'operator',
            shift TEXT NOT NULL,
            email TEXT NOT NULL,
            password_hash TEXT NOT NULL,
            permissions JSONB NOT NULL DEFAULT '[]',
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))
    await conn.execute(text("""
        CREATE UNIQUE INDEX IF NOT EXISTS users_tenant_email_idx ON users (tenant_id, email)
    """))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id BIGSERIAL PRIMARY KEY,
            user_id BIGINT NOT NULL,
            refresh_token_hash TEXT NOT NULL UNIQUE,
            expires_at TIMESTAMPTZ NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW()
        )
    """))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS categories (
            name TEXT NOT NULL,
            tenant_id TEXT NOT NULL DEFAULT 'default',
            menu_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            pos_enabled BOOLEAN NOT NULL DEFAULT FALSE,
            sort_index INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (name, tenant_id)
        )
    """))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS products (
            id TEXT NOT NULL,
            tenant_id TEXT NOT NULL DEFAULT 'default',
            name TEXT NOT NULL,
            price NUMERIC(10,2) NOT NULL,
            category_name TEXT NOT NULL,
            description TEXT NOT NULL,
            image TEXT NOT NULL,
            available BOOLEAN NOT NULL DEFAULT TRUE,
            size_prices JSONB NOT NULL DEFAULT '[]',
            sort_index INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (id, tenant_id)
        )
    """))

    await conn.execute(text("""
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER NOT NULL,
            tenant_id TEXT NOT NULL DEFAULT 'default',
            customer TEXT NOT NULL,
            phone TEXT NOT NULL,
            address TEXT NOT NULL DEFAULT '',
            items JSONB NOT NULL,
            elapsed TEXT NOT NULL,
            value NUMERIC(10,2) NOT NULL,
            status TEXT NOT NULL,
            payment TEXT NOT NULL,
            time TEXT NOT NULL,
            source TEXT NOT NULL DEFAULT 'Online',
            table_number JSONB,
            delivery_fee NUMERIC(10,2),
            notes TEXT NOT NULL DEFAULT '',
            sort_index INTEGER NOT NULL,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW(),
            PRIMARY KEY (id, tenant_id)
        )
    """))
    print("✅ Tabelas criadas/verificadas")


async def seed_users(session: AsyncSession):
    result = await session.execute(text("SELECT COUNT(*) FROM users WHERE tenant_id = 'default'"))
    count = result.scalar_one()
    if count > 0:
        print(f"⏭️  Usuários já existem ({count}), pulando")
        return

    perms = {
        "admin": ["users:read", "users:create", "users:update", "users:change-password", "catalog:write", "orders:write"],
        "manager": ["users:read", "users:change-password", "catalog:write", "orders:write"],
        "operator": ["users:change-password", "catalog:write", "orders:write"],
    }

    users = [
        ("Washington", "Administrador", "admin", "Caixa 01 - Aberto", "contato@taperaspizzaria.com.br"),
        ("Gerente Teste", "Gerente", "manager", "Gerencia - Aberto", "gerente@taperaspizzaria.com.br"),
        ("Operador Teste", "Operador", "operator", "Caixa 02 - Aberto", "operador@taperaspizzaria.com.br"),
    ]

    for name, role, role_key, shift, email in users:
        h = pwd.hash("123456")
        p = json.dumps(perms[role_key])
        await session.execute(text("""
            INSERT INTO users (tenant_id, name, role, role_key, shift, email, password_hash, permissions)
            VALUES ('default', :name, :role, :role_key, :shift, :email, :hash, :perms::jsonb)
            ON CONFLICT (tenant_id, email) DO NOTHING
        """), {"name": name, "role": role, "role_key": role_key, "shift": shift, "email": email, "hash": h, "perms": p})

    print("✅ Usuários criados: contato@, gerente@, operador@ (senha: 123456)")


async def seed_categories(session: AsyncSession):
    result = await session.execute(text("SELECT COUNT(*) FROM categories WHERE tenant_id = 'default'"))
    if result.scalar_one() > 0:
        print("⏭️  Categorias já existem, pulando")
        return

    cats = [
        ("Pizzas Tradicionais", True, True),
        ("Pizzas Especiais", False, True),
        ("Pizzas Doces", True, True),
        ("Bebidas", True, True),
        ("Batatas Fritas", True, True),
        ("Outros", False, True),
    ]
    for i, (name, menu, pos) in enumerate(cats):
        await session.execute(text("""
            INSERT INTO categories (name, tenant_id, menu_enabled, pos_enabled, sort_index)
            VALUES (:name, 'default', :menu, :pos, :idx)
            ON CONFLICT (name, tenant_id) DO NOTHING
        """), {"name": name, "menu": menu, "pos": pos, "idx": i})

    print(f"✅ {len(cats)} categorias criadas")


async def seed_products(session: AsyncSession):
    result = await session.execute(text("SELECT COUNT(*) FROM products WHERE tenant_id = 'default'"))
    if result.scalar_one() > 0:
        print("⏭️  Produtos já existem, pulando")
        return

    products = [
        ("calabresa-g", "Pizza Calabresa G", 52.90, "Pizzas Tradicionais", "Molho de tomate, mussarela, calabresa e cebola", "https://images.unsplash.com/photo-1513104890138-7c749659a591?w=400"),
        ("frango-g", "Pizza Frango com Catupiry G", 56.90, "Pizzas Tradicionais", "Molho de tomate, mussarela, frango desfiado e catupiry", "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400"),
        ("margherita-g", "Pizza Margherita G", 48.90, "Pizzas Tradicionais", "Molho de tomate, mussarela fresca e manjericão", "https://images.unsplash.com/photo-1604382355076-af4b0eb60143?w=400"),
        ("portuguesa-g", "Pizza Portuguesa G", 54.90, "Pizzas Tradicionais", "Molho de tomate, mussarela, presunto, ovos, cebola e azeitona", "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400"),
        ("quatro-queijos-g", "Pizza Quatro Queijos G", 59.90, "Pizzas Especiais", "Molho branco, mussarela, gorgonzola, parmesão e provolone", "https://images.unsplash.com/photo-1548369937-47519962c11a?w=400"),
        ("chocolate-g", "Pizza Chocolate G", 49.90, "Pizzas Doces", "Creme de chocolate, morango e leite condensado", "https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=400"),
        ("coca-2l", "Coca-Cola 2L", 12.00, "Bebidas", "Refrigerante Coca-Cola 2 litros gelado", "https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=400"),
        ("suco-laranja", "Suco de Laranja 500ml", 9.00, "Bebidas", "Suco natural de laranja sem adição de açúcar", "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=400"),
        ("batata-frita-m", "Batata Frita M", 18.90, "Batatas Fritas", "Batata frita crocante com sal e tempero especial", "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400"),
        ("agua-500ml", "Água Mineral 500ml", 4.00, "Bebidas", "Água mineral sem gás gelada", "https://images.unsplash.com/photo-1548839140-29a749e1cf4d?w=400"),
    ]

    for i, (pid, name, price, cat, desc, img) in enumerate(products):
        await session.execute(text("""
            INSERT INTO products (id, tenant_id, name, price, category_name, description, image, available, size_prices, sort_index)
            VALUES (:id, 'default', :name, :price, :cat, :desc, :img, true, '[]'::jsonb, :idx)
            ON CONFLICT (id, tenant_id) DO NOTHING
        """), {"id": pid, "name": name, "price": price, "cat": cat, "desc": desc, "img": img, "idx": i})

    print(f"✅ {len(products)} produtos criados")


async def seed_orders(session: AsyncSession):
    result = await session.execute(text("SELECT COUNT(*) FROM orders WHERE tenant_id = 'default'"))
    if result.scalar_one() > 0:
        print("⏭️  Pedidos já existem, pulando")
        return

    orders = [
        (1, "Ana Lima", "11999990001", "Rua das Flores, 123", [{"name": "Pizza Calabresa G", "qty": 1, "price": 52.90}], "22 min", 52.90, "Entregue", "PIX", "19:45"),
        (2, "Carlos Sousa", "11999990002", "Av. Brasil, 456", [{"name": "Pizza Frango com Catupiry G", "qty": 1, "price": 56.90}, {"name": "Coca-Cola 2L", "qty": 1, "price": 12.00}], "35 min", 68.90, "Em preparo", "Cartão", "20:10"),
        (3, "Maria Santos", "11999990003", "", [{"name": "Pizza Quatro Queijos G", "qty": 1, "price": 59.90}], "12 min", 59.90, "Pendente", "Dinheiro", "20:25"),
        (4, "Pedro Oliveira", "11999990004", "Rua XV, 789", [{"name": "Pizza Margherita G", "qty": 2, "price": 48.90}], "18 min", 97.80, "Saiu para entrega", "PIX", "20:15"),
        (5, "Fernanda Costa", "11999990005", "Rua das Acácias, 321", [{"name": "Pizza Chocolate G", "qty": 1, "price": 49.90}, {"name": "Suco de Laranja 500ml", "qty": 2, "price": 9.00}], "40 min", 67.90, "Entregue", "Cartão", "19:30"),
    ]

    for i, (oid, cust, phone, addr, items, elapsed, value, status, payment, time) in enumerate(orders):
        await session.execute(text("""
            INSERT INTO orders (id, tenant_id, customer, phone, address, items, elapsed, value, status, payment, time, source, sort_index)
            VALUES (:id, 'default', :cust, :phone, :addr, :items::jsonb, :elapsed, :value, :status, :payment, :time, 'Online', :idx)
            ON CONFLICT (id, tenant_id) DO NOTHING
        """), {"id": oid, "cust": cust, "phone": phone, "addr": addr, "items": json.dumps(items),
               "elapsed": elapsed, "value": value, "status": status, "payment": payment, "time": time, "idx": i})

    print(f"✅ {len(orders)} pedidos de exemplo criados")


async def main():
    print("🚀 Iniciando seed do banco Vaija...\n")
    async with engine.begin() as conn:
        await create_tables(conn)

    async with async_session() as session:
        async with session.begin():
            await seed_users(session)
            await seed_categories(session)
            await seed_products(session)
            await seed_orders(session)

    print("\n✅ Seed completo! Login: contato@taperaspizzaria.com.br / 123456")
    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())
