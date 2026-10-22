import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import { alertSoundEnabled, playAlertSound } from '@/lib/order-alerts'
import { fetchMyTickets, type SupportTicket } from '@/lib/support-api'
import { getTenantId } from '@/lib/tenant-storage'

/*
 * Avisos de suporte nos dois lados:
 *  - painel SaaS: chamado novo de qualquer loja (processNewTickets);
 *  - painel da loja: resposta ou mudança de situação nos chamados dela (processTicketUpdates).
 * O que já foi visto fica guardado neste navegador; a primeira leitura só forma a base, sem avisar.
 */

const platformSeenKey = 'vaija.saas.tickets.seen'
const storeSeenKey = 'vaija.support.seen'
const minCheckGapMs = 5_000
const maxItems = 30

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function writeJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // sem armazenamento: o aviso se repete no próximo carregamento
  }
}

/** Painel SaaS: avisa os chamados que ainda não tinham aparecido neste navegador. */
export function processNewTickets(tickets: SupportTicket[], onOpen: () => void) {
  const seen = readJson<number[]>(platformSeenKey)
  writeJson(platformSeenKey, tickets.map((ticket) => ticket.id))
  if (seen === null) return

  const known = new Set(seen)
  const fresh = tickets.filter((ticket) => !known.has(ticket.id) && ticket.status === 'Aberto')
  if (fresh.length === 0) return

  const message = fresh.length === 1 ? `Novo chamado: ${fresh[0].subject}` : `${fresh.length} novos chamados de suporte`
  toast.info(message, { action: { label: 'Abrir', onClick: onOpen }, duration: 10_000 })
  if (alertSoundEnabled()) playAlertSound()
}

export type SupportAlert = {
  ticketId: number
  subject: string
  kind: 'reply' | 'status'
  text: string
  at: number
}

type AlertState = { items: SupportAlert[]; unread: number }

let state: AlertState = { items: [], unread: 0 }
const listeners = new Set<() => void>()
let lastCheck = 0

function setState(next: Partial<AlertState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

const signature = (ticket: SupportTicket) => `${ticket.status}|${ticket.reply}`

/** Painel da loja: avisa resposta nova do suporte ou mudança de situação nos chamados da loja. */
export function processTicketUpdates(tickets: SupportTicket[]) {
  const key = `${storeSeenKey}.${getTenantId()}`
  const seen = readJson<Record<string, string>>(key)
  writeJson(key, Object.fromEntries(tickets.map((ticket) => [ticket.id, signature(ticket)])))
  if (seen === null) return

  const alerts: SupportAlert[] = []
  tickets.forEach((ticket) => {
    const before = seen[ticket.id]
    if (before === undefined || before === signature(ticket)) return
    const previousReply = before.slice(before.indexOf('|') + 1)
    const replied = ticket.reply !== '' && ticket.reply !== previousReply
    alerts.push({
      ticketId: ticket.id,
      subject: ticket.subject,
      kind: replied ? 'reply' : 'status',
      text: replied ? 'O suporte respondeu seu chamado.' : `Seu chamado agora está: ${ticket.status}.`,
      at: Date.now(),
    })
  })
  if (alerts.length === 0) return

  setState({ items: [...alerts.reverse(), ...state.items].slice(0, maxItems), unread: state.unread + alerts.length })
  toast.success(alerts.length === 1 ? `${alerts[0].text} (${alerts[0].subject})` : `${alerts.length} novidades nos seus chamados de suporte`)
  if (alertSoundEnabled()) playAlertSound()
}

export async function checkSupportUpdates() {
  const now = Date.now()
  if (now - lastCheck < minCheckGapMs) return
  lastCheck = now
  try {
    processTicketUpdates(await fetchMyTickets())
  } catch {
    // sem rede: tenta de novo no próximo ciclo
  }
}

export function markSupportAlertsRead() {
  if (state.unread > 0) setState({ unread: 0 })
}

export function clearSupportAlerts() {
  setState({ items: [], unread: 0 })
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useSupportAlerts() {
  return useSyncExternalStore(subscribe, () => state)
}
