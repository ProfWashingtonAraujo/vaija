"""Chamados de suporte: o lojista abre e acompanha; o dono da plataforma responde.

O chamado guarda só o tenant_id: o nome do restaurante vem do cadastro de clientes no painel SaaS.
"""
from typing import Literal

from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from auth import CurrentAuth, PlatformAdmin
from database import get_db
from models import SupportTicket, User

support_router = APIRouter(tags=["support"])

Priority = Literal["Baixa", "Média", "Alta"]
Status = Literal["Aberto", "Em atendimento", "Resolvido"]


class TicketIn(BaseModel):
    model_config = ConfigDict(extra="ignore")

    subject: str = Field(min_length=1, max_length=120)
    message: str = Field(default="", max_length=2000)
    priority: Priority = "Média"


class TicketUpdate(BaseModel):
    model_config = ConfigDict(extra="ignore")

    status: Status | None = None
    priority: Priority | None = None
    reply: str | None = Field(default=None, max_length=2000)


def _to_dict(ticket: SupportTicket) -> dict:
    return {
        "id": ticket.id,
        "tenantId": ticket.tenant_id,
        "subject": ticket.subject,
        "message": ticket.message or "",
        "priority": ticket.priority,
        "status": ticket.status,
        "reply": ticket.reply or "",
        "createdBy": ticket.created_by,
        "createdAt": ticket.created_at.isoformat(),
        "updatedAt": ticket.updated_at.isoformat(),
    }


def _error(status: int, code: str) -> JSONResponse:
    return JSONResponse({"ok": False, "error": code}, status_code=status)


@support_router.get("/api/support/tickets")
async def list_my_tickets(auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(
        select(SupportTicket).where(SupportTicket.tenant_id == auth.tenant_id).order_by(SupportTicket.id.desc())
    )).scalars().all()
    return {"tickets": [_to_dict(row) for row in rows]}


@support_router.post("/api/support/tickets", status_code=201)
async def create_ticket(body: TicketIn, auth: CurrentAuth, db: AsyncSession = Depends(get_db)):
    subject = body.subject.strip()
    if not subject:
        return _error(400, "invalid_subject")
    author = (await db.execute(select(User.name).where(User.id == auth.user_id))).scalar_one_or_none()
    ticket = SupportTicket(
        tenant_id=auth.tenant_id, subject=subject, message=body.message.strip(),
        priority=body.priority, created_by=author or "",
    )
    db.add(ticket)
    await db.flush()
    await db.refresh(ticket)
    return {"ticket": _to_dict(ticket)}


@support_router.get("/api/platform/support/tickets")
async def list_all_tickets(_: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    rows = (await db.execute(select(SupportTicket).order_by(SupportTicket.id.desc()))).scalars().all()
    return {"tickets": [_to_dict(row) for row in rows]}


@support_router.patch("/api/platform/support/tickets/{ticket_id}")
async def update_ticket(ticket_id: int, body: TicketUpdate, _: PlatformAdmin, db: AsyncSession = Depends(get_db)):
    ticket = (await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))).scalar_one_or_none()
    if not ticket:
        return _error(404, "ticket_not_found")
    if body.status is not None:
        ticket.status = body.status
    if body.priority is not None:
        ticket.priority = body.priority
    if body.reply is not None:
        ticket.reply = body.reply.strip() or None
    ticket.updated_at = func.now()
    await db.flush()
    await db.refresh(ticket)
    return {"ticket": _to_dict(ticket)}
