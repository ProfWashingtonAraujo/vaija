from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models import Category, IngredientStock, Product
from schemas import CategoriesPayload, IngredientMissingUpdate, ProductsPayload
from auth import CurrentAuth

catalog_router = APIRouter(tags=["catalog"])


def _error(code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=400)


# ── Ingredientes em falta ─────────────────────────────────────────────────────

def _key(name: str) -> str:
    return " ".join(name.split()).lower()


def _clean_ingredients(names: list[str]) -> list[str]:
    """Remove vazios e duplicados (sem diferenciar maiúsculas), mantendo a primeira grafia."""
    seen: dict[str, str] = {}
    for name in names:
        label = " ".join(name.split())
        if label and _key(label) not in seen:
            seen[_key(label)] = label
    return list(seen.values())


async def _missing_keys(db: AsyncSession, tenant_id: str) -> set[str]:
    result = await db.execute(
        select(IngredientStock.key).where(
            IngredientStock.tenant_id == tenant_id, IngredientStock.missing.is_(True)
        )
    )
    return set(result.scalars().all())


def _blocked_by(product: Product, missing: set[str]) -> list[str]:
    return [name for name in (product.ingredients or []) if _key(name) in missing]


def _product_dict(p: Product, missing: set[str]) -> dict:
    return {
        "id": p.id,
        "name": p.name,
        "price": float(p.price),
        "category": p.category_name,
        "description": p.description,
        "image": p.image,
        "available": p.available,
        "sizePrices": p.size_prices or [],
        "ingredients": p.ingredients or [],
        "blockedBy": _blocked_by(p, missing),
    }


async def blocked_product_names(db: AsyncSession, tenant_id: str) -> list[str]:
    """Nomes dos produtos que não podem ser vendidos agora por falta de ingrediente."""
    missing = await _missing_keys(db, tenant_id)
    if not missing:
        return []
    result = await db.execute(select(Product).where(Product.tenant_id == tenant_id))
    return [p.name for p in result.scalars().all() if _blocked_by(p, missing)]


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
    missing = await _missing_keys(db, auth.tenant_id)
    return {"products": [_product_dict(p, missing) for p in prods]}


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
            ingredients=_clean_ingredients(prod_in.ingredients),
            sort_index=i,
        ))
    await db.flush()
    return {"ok": True, "products": [p.model_dump(by_alias=True) for p in products]}


# ── Ingredients ───────────────────────────────────────────────────────────────

@catalog_router.get("/api/ingredients")
async def get_ingredients(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    """Ingredientes usados nos produtos, com a marcação de "em falta"."""
    missing = await _missing_keys(db, auth.tenant_id)
    result = await db.execute(select(Product).where(Product.tenant_id == auth.tenant_id))
    found: dict[str, dict] = {}
    for product in result.scalars().all():
        for name in _clean_ingredients(product.ingredients or []):
            entry = found.setdefault(_key(name), {"name": name, "missing": _key(name) in missing, "productCount": 0})
            entry["productCount"] += 1
    return {"ingredients": sorted(found.values(), key=lambda item: item["name"].lower())}


@catalog_router.put("/api/ingredients")
async def put_ingredient(
    body: IngredientMissingUpdate,
    auth: CurrentAuth,
    db: AsyncSession = Depends(get_db),
):
    key = _key(body.name)
    if not key:
        return _error("invalid_ingredient")
    stmt = insert(IngredientStock).values(tenant_id=auth.tenant_id, key=key, missing=body.missing)
    await db.execute(stmt.on_conflict_do_update(
        index_elements=[IngredientStock.tenant_id, IngredientStock.key],
        set_={"missing": body.missing},
    ))
    return {"ok": True, "name": body.name, "missing": body.missing}


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
    """Cardápio online: produtos desativados ou sem ingrediente (em falta) somem da lista."""
    result = await db.execute(
        select(Product)
        .where(Product.tenant_id == tenant_id, Product.available.is_(True))
        .order_by(Product.sort_index)
    )
    missing = await _missing_keys(db, tenant_id)
    return {
        "products": [
            _product_dict(p, missing)
            for p in result.scalars().all()
            if not _blocked_by(p, missing)
        ]
    }
