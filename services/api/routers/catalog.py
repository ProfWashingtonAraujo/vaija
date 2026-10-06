from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Category, Product
from schemas import CategoriesPayload, ProductsPayload
from auth import CurrentAuth

catalog_router = APIRouter(tags=["catalog"])


def _error(code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=400)


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
    payload: CategoriesPayload,
    auth: CurrentAuth,
    db: AsyncSession = Depends(get_db),
):
    categories = payload.categories
    if categories is None or any(not category.is_valid() for category in categories):
        return _error("invalid_categories_payload")

    await db.execute(delete(Category).where(Category.tenant_id == auth.tenant_id))
    for i, cat_in in enumerate(categories):
        db.add(Category(
            name=cat_in.name,
            tenant_id=auth.tenant_id,
            menu_enabled=cat_in.menu_enabled,
            pos_enabled=cat_in.pos_enabled,
            sort_index=i,
        ))
    await db.flush()
    return {"ok": True, "categories": [c.model_dump(by_alias=True) for c in categories]}


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
    payload: ProductsPayload,
    auth: CurrentAuth,
    db: AsyncSession = Depends(get_db),
):
    products = payload.products
    if products is None or any(not product.is_valid() for product in products):
        return _error("invalid_products_payload")

    await db.execute(delete(Product).where(Product.tenant_id == auth.tenant_id))
    for i, prod_in in enumerate(products):
        db.add(Product(
            id=prod_in.id,
            tenant_id=auth.tenant_id,
            name=prod_in.name,
            price=prod_in.price,
            category_name=prod_in.category,
            description=prod_in.description,
            image=prod_in.image,
            available=prod_in.available,
            size_prices=[sp.model_dump() for sp in prod_in.size_prices],
            sort_index=i,
        ))
    await db.flush()
    return {"ok": True, "products": [p.model_dump(by_alias=True) for p in products]}


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
