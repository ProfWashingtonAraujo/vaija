import { apiFetch } from '@/lib/api-client'
import { getTenantId } from '@/lib/tenant-storage'

export type CourierJob = {
  orderId: number
  customer: string
  phone: string
  address: string
  items: string[]
  notes: string
  payment: string
  value: number
  started: boolean
  finished: boolean
}

export type CourierLocation = {
  active: boolean
  latitude?: number
  longitude?: number
  updatedAt?: string | null
}

const jsonHeaders = { 'Content-Type': 'application/json' }

export type DeliveryEntry = {
  orderId: number
  state: 'waiting' | 'active' | 'finished'
  courierName: string | null
  customer: string
  address: string
  value: number
  createdAt: string | null
  startedAt: string | null
  finishedAt: string | null
  /** Nome de quem encerrou a entrega no lugar do entregador; null quando o próprio entregador finalizou. */
  finishedBy: string | null
  location: { latitude: number; longitude: number; updatedAt: string | null } | null
}

/** Gerente/administrador: entregas em rota, aguardando início e finalizadas desde `since`. */
export async function fetchDeliveries(since: string): Promise<{ deliveries: DeliveryEntry[]; couriers: string[] }> {
  const response = await apiFetch(`/api/deliveries?since=${encodeURIComponent(since)}`, { headers: { 'X-Tenant-Id': getTenantId() } })
  if (!response.ok) throw new Error(`failed_to_fetch_deliveries:${response.status}`)
  return await response.json() as { deliveries: DeliveryEntry[]; couriers: string[] }
}

export type CourierEarnings = {
  percent: number
  start: string | null
  end: string | null
  couriers: Array<{
    name: string
    count: number
    fees: number
    pay: number
    paid: number
    pending: number
    store: number
    /** % própria do entregador no cadastro; null = padrão da loja. */
    payPercent: number | null
    deliveries: Array<{ orderId: number; customer: string; finishedAt: string | null; fee: number; pay: number; paid: boolean }>
  }>
  totals: { count: number; fees: number; pay: number; paid: number; pending: number; store: number }
}

export type CourierPayout = {
  id: number
  courierName: string
  amount: number
  count: number
  paidBy: string | null
  paidAt: string | null
  /** O dinheiro saiu do caixa (sangria registrada no caixa aberto). */
  fromCash?: boolean
}

/** Pagamentos registrados que cobrem o período. */
export async function fetchCourierPayouts(start: string, end: string): Promise<CourierPayout[]> {
  const response = await apiFetch(`/api/deliveries/payouts?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { headers: { 'X-Tenant-Id': getTenantId() } })
  if (!response.ok) throw new Error(`failed_to_fetch_courier_payouts:${response.status}`)
  return (await response.json() as { payouts: CourierPayout[] }).payouts
}

/** Marca como pagas as entregas ainda a pagar de um entregador no período. */
export class PayoutError extends Error {
  code: string

  constructor(status: number, code: string) {
    super(`courier_payout_failed:${status}:${code}`)
    this.code = code
  }
}

export function payoutErrorMessage(error: unknown, fallback: string) {
  if (error instanceof PayoutError) {
    if (error.code === 'cash_closed') return 'O caixa está fechado. Abra o caixa para pagar com o dinheiro da gaveta.'
    if (error.code === 'payout_cash_closed') return 'Esse pagamento saiu de um caixa que já foi fechado, então não dá para desfazer por aqui.'
  }
  return fallback
}

async function payoutFailure(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string }
  return new PayoutError(response.status, body.error ?? 'unknown')
}

export async function createCourierPayout(courierName: string, start: string, end: string, fromCash = false): Promise<CourierPayout> {
  const response = await apiFetch('/api/deliveries/payouts', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': getTenantId() },
    body: JSON.stringify({ courierName, start, end, fromCash }),
  })
  if (!response.ok) throw await payoutFailure(response)
  return (await response.json() as { payout: CourierPayout }).payout
}

/** Desfaz um pagamento registrado por engano. */
export async function undoCourierPayout(id: number) {
  const response = await apiFetch(`/api/deliveries/payouts/${id}`, { method: 'DELETE', headers: { 'X-Tenant-Id': getTenantId() } })
  if (!response.ok) throw await payoutFailure(response)
}

/** Gerente/administrador: quanto pagar a cada entregador entre `start` e `end` (ISO, fim exclusivo). */
export async function fetchCourierEarnings(start: string, end: string): Promise<CourierEarnings> {
  const response = await apiFetch(`/api/deliveries/earnings?start=${encodeURIComponent(start)}&end=${encodeURIComponent(end)}`, { headers: { 'X-Tenant-Id': getTenantId() } })
  if (!response.ok) throw new Error(`failed_to_fetch_courier_earnings:${response.status}`)
  return await response.json() as CourierEarnings
}

/** Gerente/administrador: encerra uma entrega em rota quando o entregador não consegue finalizar. */
export async function finishDeliveryAsManager(orderId: number) {
  const response = await apiFetch(`/api/deliveries/${orderId}/finish`, { method: 'POST', headers: { 'X-Tenant-Id': getTenantId() } })
  if (!response.ok) throw new Error(`failed_to_finish_delivery_manually:${response.status}`)
}

export class CourierLinkError extends Error {
  status: number
  code: string

  constructor(status: number, code: string) {
    super(`failed_to_create_courier_link:${status}:${code}`)
    this.status = status
    this.code = code
  }
}

/** Texto para o restaurante a partir do erro de createCourierLink, com o motivo real quando a API o informa. */
export function courierLinkErrorMessage(error: unknown) {
  if (error instanceof CourierLinkError) {
    if (error.code === 'order_closed') return 'Este pedido já foi finalizado ou cancelado, então não precisa mais de link do entregador.'
    if (error.code === 'not_a_delivery_order') return 'Só pedidos online têm link de entregador.'
    if (error.code === 'order_not_found') return 'Pedido não encontrado. Atualize a tela e tente de novo.'
    if (error.status === 401 || error.status === 403) return 'Sua sessão expirou. Entre de novo e tente outra vez.'
    if (error.status >= 500) return 'O servidor teve um problema ao gerar o link. Tente de novo em instantes.'
  }
  // sem resposta (internet ou servidor reiniciando)
  if (error instanceof TypeError) return 'Sem resposta do servidor. Se a API acabou de ser atualizada, aguarde alguns minutos e tente de novo.'
  return 'Não foi possível gerar o link do entregador. Tente de novo.'
}

/** Restaurante: gera o link do entregador. O token só é devolvido nesta chamada. */
export async function createCourierLink(orderId: number, courierName?: string): Promise<string> {
  const response = await apiFetch(`/api/orders/${orderId}/courier-link`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': getTenantId() },
    body: JSON.stringify({ courierName: courierName?.trim() || undefined }),
  })
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { error?: string }
    throw new CourierLinkError(response.status, body.error ?? 'unknown')
  }
  const data = await response.json() as { token: string }
  return data.token
}

/** Entregador (sem login): todas as chamadas usam o token do link e não tentam renovar sessão. */
export async function fetchCourierJob(token: string): Promise<CourierJob> {
  const response = await apiFetch(`/api/courier/${encodeURIComponent(token)}`, undefined, false)
  if (!response.ok) throw new Error(`failed_to_fetch_courier_job:${response.status}`)
  return await response.json() as CourierJob
}

async function courierPost(token: string, action: 'start' | 'finish') {
  const response = await apiFetch(`/api/courier/${encodeURIComponent(token)}/${action}`, { method: 'POST' }, false)
  if (!response.ok) throw new Error(`failed_to_${action}_delivery:${response.status}`)
}

export const startDelivery = (token: string) => courierPost(token, 'start')
export const finishDelivery = (token: string) => courierPost(token, 'finish')

export async function sendCourierLocation(token: string, position: { latitude: number; longitude: number; accuracy?: number }) {
  const response = await apiFetch(`/api/courier/${encodeURIComponent(token)}/location`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify(position),
  }, false)
  if (!response.ok) throw new Error(`failed_to_send_location:${response.status}`)
}

/** Cliente (sem login): posição atual do entregador enquanto a entrega está em andamento. */
export async function fetchPublicCourierLocation(tenantId: string, orderId: number): Promise<CourierLocation> {
  const response = await apiFetch(`/api/public/${encodeURIComponent(tenantId)}/orders/${orderId}/courier`, undefined, false)
  if (!response.ok) throw new Error(`failed_to_fetch_courier_location:${response.status}`)
  return await response.json() as CourierLocation
}
