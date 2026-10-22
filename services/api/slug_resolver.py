"""Endereço amigável da loja: /api/public/<slug>/... vira /api/public/<id da loja>/... antes de chegar nas rotas.

Assim as rotas públicas continuam recebendo o id interno; o slug só existe na borda. O mapa slug -> id fica
em memória e é relido a cada 30 s (e na hora, quando a própria instância altera um slug).
"""
import logging
import time
from urllib.parse import quote

from sqlalchemy import select

from database import async_session
from models import Tenant

logger = logging.getLogger(__name__)

_TTL_SECONDS = 30
_cache: dict[str, str] = {}
_loaded_at = 0.0


def invalidate_slug_cache() -> None:
    global _loaded_at
    _loaded_at = 0.0


async def resolve_slug(segment: str) -> str | None:
    global _cache, _loaded_at
    if time.monotonic() - _loaded_at > _TTL_SECONDS:
        try:
            async with async_session() as session:
                rows = (await session.execute(select(Tenant.slug, Tenant.id).where(Tenant.slug.is_not(None)))).all()
            _cache = {slug: tenant_id for slug, tenant_id in rows}
            _loaded_at = time.monotonic()
        except Exception:
            logger.exception("Falha ao carregar os endereços amigáveis das lojas.")
            _loaded_at = time.monotonic() - _TTL_SECONDS + 5  # tenta de novo em 5 s, mantendo o mapa anterior
    return _cache.get(segment)


class SlugRewriteMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "http" and scope["path"].startswith("/api/public/"):
            parts = scope["path"].split("/")  # ["", "api", "public", "<segmento>", ...]
            if len(parts) > 3 and parts[3]:
                tenant_id = await resolve_slug(parts[3])
                if tenant_id:
                    parts[3] = tenant_id
                    path = "/".join(parts)
                    scope = {**scope, "path": path, "raw_path": quote(path, safe="/").encode()}
        await self.app(scope, receive, send)
