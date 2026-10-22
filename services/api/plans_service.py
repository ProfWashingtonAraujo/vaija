"""Catálogo de planos (preço, descrição e se aparece na página de vendas), guardado no servidor.

É a única fonte de preço: a página de vendas, o checkout e a cobrança no Asaas leem daqui.
"""
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models import PlanConfig

PLAN_KEYS = ("Free", "Start", "Pro", "Premium")

DEFAULT_PLANS: dict[str, dict] = {
    "Free": {"price": 0.0, "active": True, "description": "Plano gratuito para começar com pedidos online e configuração básica."},
    "Start": {"price": 79.0, "active": True, "description": "Entrada para pedido online e operação simples."},
    "Pro": {"price": 149.0, "active": True, "description": "Operação com painel, PDV, pedidos e cardápio."},
    "Premium": {"price": 249.0, "active": True, "description": "Gestão completa com operador, controle de ingredientes e relatórios."},
}


async def load_plans(db: AsyncSession) -> list[dict]:
    """Os quatro planos, com o que foi salvo pelo dono e o padrão para o resto."""
    saved = {row.key: row for row in (await db.execute(select(PlanConfig))).scalars().all()}
    plans = []
    for key in PLAN_KEYS:
        row = saved.get(key)
        default = DEFAULT_PLANS[key]
        plans.append({
            "key": key,
            "price": float(row.price) if row else default["price"],
            "active": row.active if row else default["active"],
            "description": row.description if row else default["description"],
        })
    return plans


async def plan_prices(db: AsyncSession) -> dict[str, float]:
    return {plan["key"]: plan["price"] for plan in await load_plans(db)}
