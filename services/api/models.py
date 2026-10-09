"""
Modelos SQLAlchemy — espelham exatamente o schema criado pelo store.go do Go.
Tabelas são criadas com create_all (idempotente) ou via Alembic.
"""
from datetime import datetime
from typing import Any
from sqlalchemy import (
    BigInteger, Boolean, DateTime, Float, Integer, Numeric,
    String, Text, func, Index,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("users_username_idx", "username", unique=True),
        Index("users_tenant_idx", "tenant_id"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False, default="default")
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)
    role_key: Mapped[str] = mapped_column(String, nullable=False, default="operator")
    shift: Mapped[str] = mapped_column(String, nullable=False)
    username: Mapped[str] = mapped_column(String, nullable=False)  # login; único em todo o sistema
    email: Mapped[str | None] = mapped_column(String, nullable=True)  # contato opcional, não é usado no login
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    permissions: Mapped[list[str]] = mapped_column(JSONB, nullable=False, default=list)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    refresh_token_hash: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Category(Base):
    __tablename__ = "categories"
    __table_args__ = (
        Index("categories_tenant_idx", "tenant_id"),
        Index("categories_sort_index_idx", "sort_index"),
    )

    name: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, primary_key=True, default="default")
    menu_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    pos_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    sort_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Product(Base):
    __tablename__ = "products"
    __table_args__ = (
        Index("products_tenant_idx", "tenant_id"),
        Index("products_sort_index_idx", "sort_index"),
    )

    id: Mapped[str] = mapped_column(String, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, primary_key=True, default="default")
    name: Mapped[str] = mapped_column(String, nullable=False)
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    category_name: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    image: Mapped[str] = mapped_column(Text, nullable=False)
    available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    size_prices: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list)
    ingredients: Mapped[list[Any]] = mapped_column(JSONB, nullable=False, default=list, server_default="[]")
    sort_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class IngredientStock(Base):
    """Lista geral de ingredientes e se estão em falta. `key` é o nome normalizado (minúsculas, sem espaços
    nas pontas); `name` é o nome como foi cadastrado (vazio em linhas antigas, que só guardam a marcação)."""
    __tablename__ = "ingredient_stock"

    tenant_id: Mapped[str] = mapped_column(String, primary_key=True)
    key: Mapped[str] = mapped_column(String, primary_key=True)
    name: Mapped[str | None] = mapped_column(String, nullable=True)  # nome cadastrado na lista geral
    missing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Order(Base):
    __tablename__ = "orders"
    __table_args__ = (
        Index("orders_tenant_idx", "tenant_id"),
        Index("orders_sort_index_idx", "sort_index"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tenant_id: Mapped[str] = mapped_column(String, primary_key=True, default="default")
    customer: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    address: Mapped[str] = mapped_column(String, nullable=False, default="")
    items: Mapped[Any] = mapped_column(JSONB, nullable=False)
    elapsed: Mapped[str] = mapped_column(String, nullable=False)
    value: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    payment: Mapped[str] = mapped_column(String, nullable=False)
    time: Mapped[str] = mapped_column(String, nullable=False)
    source: Mapped[str] = mapped_column(String, nullable=False, default="Online")
    table_number: Mapped[Any] = mapped_column(JSONB, nullable=True)
    delivery_fee: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    notes: Mapped[str] = mapped_column(String, nullable=False, default="")
    sort_index: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class CashRegister(Base):
    __tablename__ = "cash_registers"

    tenant_id: Mapped[str] = mapped_column(String, primary_key=True)
    is_open: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_by: Mapped[str | None] = mapped_column(String, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by: Mapped[str | None] = mapped_column(String, nullable=True)


class RestaurantSettings(Base):
    """Configurações do restaurante (dados, entrega, horários, pagamentos, preferências) como JSON.

    Precisam viver no servidor: o cliente que pede pelo link público usa a taxa de entrega, o CEP de
    origem, o nome e a logo, e o navegador dele não tem nada do que foi salvo no navegador do dono.
    """
    __tablename__ = "restaurant_settings"

    tenant_id: Mapped[str] = mapped_column(String, primary_key=True)
    data: Mapped[dict[str, Any]] = mapped_column(JSONB, nullable=False, default=dict)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Delivery(Base):
    """Entrega de um pedido com rastreamento do entregador.

    O entregador não tem login: o restaurante gera um link com token secreto (guardamos só o hash).
    A posição é sobrescrita a cada atualização; não guardamos histórico do trajeto.
    """
    __tablename__ = "deliveries"
    __table_args__ = (Index("deliveries_token_hash_idx", "token_hash", unique=True),)

    tenant_id: Mapped[str] = mapped_column(String, primary_key=True)
    order_id: Mapped[int] = mapped_column(Integer, primary_key=True)
    token_hash: Mapped[str] = mapped_column(String, nullable=False)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
