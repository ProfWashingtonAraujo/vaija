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

/** Restaurante: gera o link do entregador. O token só é devolvido nesta chamada. */
export async function createCourierLink(orderId: number): Promise<string> {
  const response = await apiFetch(`/api/orders/${orderId}/courier-link`, {
    method: 'POST',
    headers: { 'X-Tenant-Id': getTenantId() },
  })
  if (!response.ok) throw new Error(`failed_to_create_courier_link:${response.status}`)
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
