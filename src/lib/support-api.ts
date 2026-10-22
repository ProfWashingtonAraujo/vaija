import { apiFetch } from '@/lib/api-client'

export type TicketPriority = 'Baixa' | 'Média' | 'Alta'
export type TicketStatus = 'Aberto' | 'Em atendimento' | 'Resolvido'

export type SupportTicket = {
  id: number
  tenantId: string
  subject: string
  message: string
  priority: TicketPriority
  status: TicketStatus
  reply: string
  createdBy: string
  createdAt: string
  updatedAt: string
}

export type TicketInput = { subject: string; message: string; priority: TicketPriority }

/** WhatsApp do suporte Vaija, no formato internacional (55 + DDD + número). */
export const supportWhatsapp = '5588998388079'

export function supportWhatsappUrl(message: string) {
  return `https://wa.me/${supportWhatsapp}?text=${encodeURIComponent(message)}`
}

const jsonHeaders = { 'Content-Type': 'application/json' }

async function readTickets(response: Response) {
  if (!response.ok) throw new Error(`support_request_failed:${response.status}`)
  return (await response.json() as { tickets: SupportTicket[] }).tickets
}

async function readTicket(response: Response) {
  if (!response.ok) throw new Error(`support_request_failed:${response.status}`)
  return (await response.json() as { ticket: SupportTicket }).ticket
}

export async function fetchMyTickets() {
  return readTickets(await apiFetch('/api/support/tickets'))
}

export async function createTicket(input: TicketInput) {
  return readTicket(await apiFetch('/api/support/tickets', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }))
}

export async function fetchAllTickets() {
  return readTickets(await apiFetch('/api/platform/support/tickets'))
}

export async function updateTicket(id: number, values: Partial<Pick<SupportTicket, 'status' | 'priority' | 'reply'>>) {
  return readTicket(await apiFetch(`/api/platform/support/tickets/${id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(values) }))
}
