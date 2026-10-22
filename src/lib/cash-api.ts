import { apiFetch } from '@/lib/api-client'
import { fetchCashRegister } from '@/lib/cash-register'
import { getTenantId } from '@/lib/tenant-storage'

export type CashSessionInfo = {
  id: number
  openedAt: string | null
  openedBy: string
  openingFloat: number
  openingNote: string | null
  closedAt: string | null
  closedBy: string | null
  closingNote: string | null
  countedCash: number | null
  expectedCash: number | null
  difference: number | null
}

export type CashMovementKind = 'sangria' | 'suprimento'

export type CashMovement = {
  id: number
  kind: CashMovementKind
  amount: number
  reason: string
  note: string | null
  createdBy: string
  createdAt: string | null
}

export type CashReport = {
  session: CashSessionInfo
  period: { start: string | null; end: string | null }
  sales: {
    count: number
    gross: number
    deliveryFees: number
    products: number
    byPayment: Array<{ method: string; count: number; total: number }>
    bySource: Array<{ source: string; count: number; total: number }>
  }
  pix: { unconfirmedCount: number; unconfirmedTotal: number }
  cancelled: { count: number; total: number }
  movements: CashMovement[]
  cash: { openingFloat: number; cashSales: number; suprimentos: number; sangrias: number; expected: number }
}

export type CashSessionSummary = CashSessionInfo & { salesCount: number; gross: number }

export const movementReasons: Record<CashMovementKind, Array<[string, string]>> = {
  sangria: [['cofre', 'Levar ao cofre'], ['gas', 'Gás'], ['gelo', 'Gelo'], ['compra', 'Compra rápida'], ['outro', 'Outro']],
  suprimento: [['troco', 'Reforço de troco'], ['outro', 'Outro']],
}

export function reasonLabel(kind: CashMovementKind, reason: string) {
  return movementReasons[kind].find(([key]) => key === reason)?.[1] ?? reason
}

export class CashApiError extends Error {
  code: string

  constructor(status: number, code: string) {
    super(`cash_request_failed:${status}:${code}`)
    this.code = code
  }
}

export function cashErrorMessage(error: unknown) {
  if (error instanceof CashApiError) {
    if (error.code === 'already_open') return 'O caixa já está aberto. Atualize a tela.'
    if (error.code === 'cash_closed') return 'O caixa está fechado. Abra o caixa primeiro.'
    if (error.code === 'forbidden') return 'Só administrador ou gerente pode mexer no caixa.'
    if (error.code === 'invalid_reason') return 'Escolha um motivo válido.'
  }
  return 'Não foi possível concluir. Verifique a internet e tente de novo.'
}

const headers = () => ({ 'Content-Type': 'application/json', 'X-Tenant-Id': getTenantId() })

async function failure(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string }
  return new CashApiError(response.status, body.error ?? 'unknown')
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const response = await apiFetch(path, { method: 'POST', headers: headers(), body: JSON.stringify(body) })
  if (!response.ok) throw await failure(response)
  return await response.json() as T
}

/** Valor digitado em reais: aceita "1.200,50", "1200,5" ou "1200.50". Vazio ou inválido vira null. */
export function parseMoney(text: string): number | null {
  const clean = text.trim().replace(/\s/g, '').replace(/^R\$/i, '')
  if (!clean) return null
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean
  const value = Number(normalized)
  return Number.isFinite(value) && value >= 0 ? Math.round(value * 100) / 100 : null
}

/** Leitura X: sessão aberta com as vendas e movimentações até agora. null quando o caixa está fechado. */
export async function fetchCurrentCash(): Promise<CashReport | null> {
  const response = await apiFetch('/api/cash/current', { headers: { 'X-Tenant-Id': getTenantId() } })
  if (!response.ok) throw await failure(response)
  const data = await response.json() as { open: boolean; report?: CashReport }
  return data.open && data.report ? data.report : null
}

/** Abre o caixa com o fundo de troco e libera os pedidos online. */
export async function openCash(openingFloat: number, note: string): Promise<CashReport> {
  const data = await post<{ report: CashReport }>('/api/cash/open', { openingFloat, note: note.trim() || undefined })
  await fetchCashRegister().catch(() => undefined)
  return data.report
}

export async function addCashMovement(kind: CashMovementKind, amount: number, reason: string, note: string): Promise<CashReport> {
  const data = await post<{ report: CashReport }>('/api/cash/movements', { kind, amount, reason, note: note.trim() || undefined })
  return data.report
}

/** Fecha o caixa com o dinheiro contado; devolve o relatório final (leitura Z). */
export async function closeCash(countedCash: number, note: string): Promise<CashReport> {
  const data = await post<{ report: CashReport }>('/api/cash/close', { countedCash, note: note.trim() || undefined })
  await fetchCashRegister().catch(() => undefined)
  return data.report
}

export async function fetchCashSessions(): Promise<CashSessionSummary[]> {
  const response = await apiFetch('/api/cash/sessions', { headers: { 'X-Tenant-Id': getTenantId() } })
  if (!response.ok) throw await failure(response)
  return (await response.json() as { sessions: CashSessionSummary[] }).sessions
}

export async function fetchCashSession(id: number): Promise<CashReport> {
  const response = await apiFetch(`/api/cash/sessions/${id}`, { headers: { 'X-Tenant-Id': getTenantId() } })
  if (!response.ok) throw await failure(response)
  return (await response.json() as { report: CashReport }).report
}
