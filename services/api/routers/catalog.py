from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Category, Product
from schemas import CategoryIn, CategoryOut, ProductIn, ProductOut
from auth import CurrentAuth

catalog_router = APIRouter(tags=["catalog"])


# ── Categories ────────────────────────────────────────────────────────────────

@catalog_router.get("/api/categories")
async def get_categories(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category)
        .where(Category.tenant_id == auth.tenant_id)
        .order_by(Category.sort_index)
    )
    cats = result.scalars().all()
    return {
        "categories": [
            {"name": c.name, "menuEnabled": c.menu_enabled, "posEnabled": c.pos_enabled}
            for c in cats
        ]
    }


@catalog_router.put("/api/categories")
async def put_categories(
    body: list[CategoryIn],
    auth: CurrentAuth,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(Category).where(Category.tenant_id == auth.tenant_id))
    for i, cat_in in enumerate(body):
        db.add(Category(
            name=cat_in.name,
            tenant_id=auth.tenant_id,
            menu_enabled=cat_in.resolved_menu(),
            pos_enabled=cat_in.resolved_pos(),
            sort_index=i,
        ))
    await db.flush()
    return {"ok": True}


# ── Products ──────────────────────────────────────────────────────────────────

@catalog_router.get("/api/products")
async def get_products(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product)
        .where(Product.tenant_id == auth.tenant_id)
        .order_by(Product.sort_index)
    )
    prods = result.scalars().all()
    return {
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "price": float(p.price),
                "category": p.category_name,
                "description": p.description,
                "image": p.image,
                "available": p.available,
                "sizePrices": p.size_prices or [],
            }
            for p in prods
        ]
    }


@catalog_router.put("/api/products")
async def put_products(
    body: list[ProductIn],
    auth: CurrentAuth,
    db: AsyncSession = Depends(get_db),
):
    await db.execute(delete(Product).where(Product.tenant_id == auth.tenant_id))
    for i, prod_in in enumerate(body):
        db.add(Product(
            id=prod_in.id,
            tenant_id=auth.tenant_id,
            name=prod_in.name,
            price=prod_in.price,
            category_name=prod_in.category,
            description=prod_in.description,
            image=prod_in.image,
            available=prod_in.available,
            size_prices=[sp.model_dump() for sp in prod_in.resolved_size_prices()],
            sort_index=i,
        ))
    await db.flush()
    return {"ok": True}


# ── Public routes ─────────────────────────────────────────────────────────────

public_catalog_router = APIRouter(tags=["public"])


@public_catalog_router.get("/api/public/{tenant_id}/categories")
async def get_public_categories(tenant_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Category)
        .where(Category.tenant_id == tenant_id, Category.menu_enabled.is_(True))
        .order_by(Category.sort_index)
    )
    cats = result.scalars().all()
    return {"categories": [{"name": c.name, "menuEnabled": True, "posEnabled": c.pos_enabled} for c in cats]}


@public_catalog_router.get("/api/public/{tenant_id}/products")
async def get_public_products(tenant_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Product)
        .where(Product.tenant_id == tenant_id, Product.available.is_(True))
        .order_by(Product.sort_index)
    )
    prods = result.scalars().all()
    return {
        "products": [
            {
                "id": p.id,
                "name": p.name,
                "price": float(p.price),
                "category": p.category_name,
                "description": p.description,
                "image": p.image,
                "available": p.available,
                "sizePrices": p.size_prices or [],
            }
            for p in prods
        ]
    }
