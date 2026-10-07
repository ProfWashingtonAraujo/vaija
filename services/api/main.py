"""
Bootstrap do servidor FastAPI — registra routers, CORS, middleware e startup.
"""
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request, Response
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware

from config import get_settings
from database import ensure_bootstrap_admin, init_db
from routers import (
    auth_router,
    catalog_router,
    public_catalog_router,
    orders_router,
    public_orders_router,
    users_router,
    platform_router,
    printer_router,
    cash_register_router,
    public_cash_register_router,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Vaija API starting — initializing database…")
    await init_db()
    if bool(settings.bootstrap_admin_username) != bool(settings.bootstrap_admin_password):
        logger.warning("BOOTSTRAP_ADMIN_USERNAME e BOOTSTRAP_ADMIN_PASSWORD devem ser definidos juntos — ignorando.")
    elif settings.bootstrap_admin_password and len(settings.bootstrap_admin_password) < 12:
        logger.warning("BOOTSTRAP_ADMIN_PASSWORD precisa ter ao menos 12 caracteres — ignorando.")
    elif await ensure_bootstrap_admin(settings.bootstrap_admin_username, settings.bootstrap_admin_password):
        logger.info("Admin da plataforma criado a partir de BOOTSTRAP_ADMIN_USERNAME.")
    logger.info("Database ready.")
    yield
    logger.info("Vaija API shutting down.")


app = FastAPI(
    title="Vaija API",
    description="Backend principal da plataforma Vaija — FastAPI + PostgreSQL",
    version="2.0.0",
    lifespan=lifespan,
)

# ── CORS ─────────────────────────────────────────────────────────────────────
origins = [o.strip() for o in settings.frontend_origin.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["Authorization", "Content-Type", "X-Tenant-Id"],
    expose_headers=["*"],
)

# Erros no formato do Go: {"ok": false, "error": "<codigo>"}
@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse({"ok": False, "error": exc.detail}, status_code=exc.status_code, headers=exc.headers)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    """Corpo malformado vira 400 {ok:false,error}, como no Go (antes era 422 com 'detail')."""
    return JSONResponse({"ok": False, "error": "invalid_payload"}, status_code=400)


# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(catalog_router)
app.include_router(public_catalog_router)
app.include_router(orders_router)
app.include_router(public_orders_router)
app.include_router(users_router)
app.include_router(platform_router)
app.include_router(printer_router)
app.include_router(cash_register_router)
app.include_router(public_cash_register_router)


# ── Health check ──────────────────────────────────────────────────────────────
@app.get("/api/health", tags=["health"])
async def health():
    return {"ok": True, "database": "postgres", "runtime": "python"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=settings.backend_port,
        reload=True,
    )
