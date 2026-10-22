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
    # pagamento confirmado pelo restaurante (ex.: Pix conferido no app do banco); só muda pelo endpoint próprio
    paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    # quando o pedido chegou ao fim (Entregue ou Cancelado): é por ele que a venda cai na sessão de caixa certa
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
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


class Courier(Base):
    """Entregador cadastrado pela loja (nome e WhatsApp). Não tem login: o acesso é o link por entrega."""
    __tablename__ = "couriers"
    __table_args__ = (Index("couriers_tenant_idx", "tenant_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str | None] = mapped_column(String, nullable=True)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    # % da taxa de entrega que este entregador recebe; vazio = usa o padrão da loja
    pay_percent: Mapped[float | None] = mapped_column(Numeric(5, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


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
    courier_name: Mapped[str | None] = mapped_column(String, nullable=True)
    latitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    longitude: Mapped[float | None] = mapped_column(Float, nullable=True)
    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    location_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # preenchido só quando o restaurante encerrou a entrega no lugar do entregador (nome de quem encerrou)
    finished_by: Mapped[str | None] = mapped_column(String, nullable=True)
    # repasse ao entregador no momento em que a entrega foi finalizada (a % pode mudar depois; o histórico não)
    courier_pay: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    # pagamento em que esta entrega foi quitada; vazio = ainda a pagar
    payout_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    # acerto do dinheiro em mãos do entregador (pedido pago em dinheiro): movimentação do caixa que o recebeu
    cash_movement_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class CourierPayout(Base):
    """Pagamento registrado a um entregador: reúne as entregas quitadas de uma vez."""
    __tablename__ = "courier_payouts"
    __table_args__ = (Index("courier_payouts_tenant_idx", "tenant_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    courier_name: Mapped[str] = mapped_column(String, nullable=False, default="")
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    deliveries_count: Mapped[int] = mapped_column(Integer, nullable=False)
    period_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    period_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    paid_by: Mapped[str | None] = mapped_column(String, nullable=True)
    paid_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    # sangria do caixa que pagou este repasse; vazio = pago por fora do caixa
    movement_id: Mapped[int | None] = mapped_column(BigInteger, nullable=True)


class CashSession(Base):
    """Um turno de caixa: da abertura (com fundo de troco) ao fechamento (com o dinheiro contado)."""
    __tablename__ = "cash_sessions"
    __table_args__ = (Index("cash_sessions_tenant_idx", "tenant_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    opened_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    opened_by: Mapped[str] = mapped_column(String, nullable=False)
    opening_float: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    opening_note: Mapped[str | None] = mapped_column(String, nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    closed_by: Mapped[str | None] = mapped_column(String, nullable=True)
    closing_note: Mapped[str | None] = mapped_column(String, nullable=True)
    counted_cash: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    expected_cash: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    difference: Mapped[float | None] = mapped_column(Numeric(10, 2), nullable=True)
    # relatório completo congelado no fechamento: o histórico não muda se pedidos forem editados depois
    summary: Mapped[Any] = mapped_column(JSONB, nullable=True)


class CashMovement(Base):
    """Sangria (dinheiro que sai do caixa) ou suprimento (dinheiro que entra) dentro de uma sessão."""
    __tablename__ = "cash_movements"
    __table_args__ = (Index("cash_movements_session_idx", "tenant_id", "session_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    session_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    kind: Mapped[str] = mapped_column(String, nullable=False)  # sangria | suprimento | acerto (dinheiro recebido de entregador)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    reason: Mapped[str] = mapped_column(String, nullable=False)
    note: Mapped[str | None] = mapped_column(String, nullable=True)
    created_by: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    voided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    voided_by: Mapped[str | None] = mapped_column(String, nullable=True)


class SupportTicket(Base):
    """Chamado aberto pelo lojista; o dono da plataforma responde e muda o status em /saas/suporte."""
    __tablename__ = "support_tickets"
    __table_args__ = (Index("support_tickets_tenant_idx", "tenant_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False, default="")
    priority: Mapped[str] = mapped_column(String, nullable=False, default="Média")  # Baixa | Média | Alta
    status: Mapped[str] = mapped_column(String, nullable=False, default="Aberto")  # Aberto | Em atendimento | Resolvido
    reply: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_by: Mapped[str] = mapped_column(String, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Subscription(Base):
    """Assinatura mensal do lojista no Vaija (cobrada pelo Asaas). Uma por tenant."""
    __tablename__ = "subscriptions"

    tenant_id: Mapped[str] = mapped_column(String, primary_key=True)
    plan: Mapped[str] = mapped_column(String, nullable=False)  # Free | Start | Pro | Premium
    status: Mapped[str] = mapped_column(String, nullable=False, default="trialing")  # trialing | active | past_due | cancelled
    billing_type: Mapped[str | None] = mapped_column(String, nullable=True)  # PIX | BOLETO | CREDIT_CARD
    trial_ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    current_period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    overdue_since: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    customer_name: Mapped[str] = mapped_column(String, nullable=False, default="")
    customer_email: Mapped[str] = mapped_column(String, nullable=False, default="")
    customer_cpf_cnpj: Mapped[str] = mapped_column(String, nullable=False, default="")
    asaas_customer_id: Mapped[str | None] = mapped_column(String, nullable=True)
    asaas_subscription_id: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Invoice(Base):
    """Cobrança mensal gerada pelo Asaas; criada/atualizada pelo webhook."""
    __tablename__ = "invoices"
    __table_args__ = (Index("invoices_tenant_idx", "tenant_id"),)

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    tenant_id: Mapped[str] = mapped_column(String, nullable=False)
    asaas_payment_id: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    amount: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False, default="open")  # open | paid | overdue | cancelled | refunded
    billing_type: Mapped[str | None] = mapped_column(String, nullable=True)
    due_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    invoice_url: Mapped[str | None] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Tenant(Base):
    """Cliente (restaurante) do Vaija. O id é o mesmo tenant_id dos usuários e dos dados da loja."""
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    restaurant_name: Mapped[str] = mapped_column(String, nullable=False)
    owner_name: Mapped[str] = mapped_column(String, nullable=False, default="")
    email: Mapped[str] = mapped_column(String, nullable=False, default="")
    phone: Mapped[str] = mapped_column(String, nullable=False, default="")
    city: Mapped[str] = mapped_column(String, nullable=False, default="")
    business_type: Mapped[str] = mapped_column(String, nullable=False, default="pizzeria")
    # Endereço amigável do cardápio (/pedido/<slug>). Opcional: sem ele, vale o id.
    slug: Mapped[str | None] = mapped_column(String, nullable=True, unique=True)
    plan: Mapped[str] = mapped_column(String, nullable=False, default="Free")  # Free | Start | Pro | Premium
    status: Mapped[str] = mapped_column(String, nullable=False, default="active")  # active | inactive
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class Lead(Base):
    """Interessado que pediu para contratar um plano na página de vendas."""
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    plan: Mapped[str] = mapped_column(String, nullable=False)
    restaurant_name: Mapped[str] = mapped_column(String, nullable=False)
    owner_name: Mapped[str] = mapped_column(String, nullable=False)
    phone: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False)
    city: Mapped[str] = mapped_column(String, nullable=False)
    notes: Mapped[str] = mapped_column(Text, nullable=False, default="")
    status: Mapped[str] = mapped_column(String, nullable=False, default="Novo")  # Novo | Contatado | Convertido | Perdido
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuditLog(Base):
    """Registro do que a equipe do SaaS fez no painel."""
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    action: Mapped[str] = mapped_column(String, nullable=False)
    target: Mapped[str] = mapped_column(String, nullable=False, default="")
    actor: Mapped[str] = mapped_column(String, nullable=False, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class PlanConfig(Base):
    """Preço e texto de cada plano; o dono do SaaS edita em Planos."""
    __tablename__ = "plan_configs"

    key: Mapped[str] = mapped_column(String, primary_key=True)  # Free | Start | Pro | Premium
    price: Mapped[float] = mapped_column(Numeric(10, 2), nullable=False, default=0)
    active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
