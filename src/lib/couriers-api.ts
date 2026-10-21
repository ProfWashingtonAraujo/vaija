import { apiFetch } from '@/lib/api-client'
import { getTenantId } from '@/lib/tenant-storage'

export type Courier = {
  id: number
  name: string
  phone: string
  active: boolean
}

export type CourierInput = { name: string; phone: string; active: boolean }

export class CourierApiError extends Error {
  code: string

  constructor(status: number, code: string) {
    super(`courier_request_failed:${status}:${code}`)
    this.code = code
  }
}

const headers = () => ({ 'Content-Type': 'application/json', 'X-Tenant-Id': getTenantId() })

async function failure(response: Response) {
  const body = await response.json().catch(() => ({})) as { error?: string }
  return new CourierApiError(response.status, body.error ?? 'unknown')
}

export function courierErrorMessage(error: unknown) {
  if (error instanceof CourierApiError) {
    if (error.code === 'name_taken') return 'Já existe um entregador com esse nome.'
    if (error.code === 'invalid_name') return 'Informe o nome do entregador.'
    if (error.code === 'forbidden') return 'Só administrador ou gerente pode alterar entregadores.'
  }
  return 'Não foi possível salvar o entregador. Tente de novo.'
}

export async function fetchCouriers(): Promise<Courier[]> {
  const response = await apiFetch('/api/couriers', { headers: { 'X-Tenant-Id': getTenantId() } })
  if (!response.ok) throw await failure(response)
  return (await response.json() as { couriers: Courier[] }).couriers
}

export async function createCourier(input: CourierInput): Promise<Courier> {
  const response = await apiFetch('/api/couriers', { method: 'POST', headers: headers(), body: JSON.stringify(input) })
  if (!response.ok) throw await failure(response)
  return (await response.json() as { courier: Courier }).courier
}

export async function updateCourier(id: number, input: CourierInput): Promise<Courier> {
  const response = await apiFetch(`/api/couriers/${id}`, { method: 'PUT', headers: headers(), body: JSON.stringify(input) })
  if (!response.ok) throw await failure(response)
  return (await response.json() as { courier: Courier }).courier
}

export async function deleteCourier(id: number) {
  const response = await apiFetch(`/api/couriers/${id}`, { method: 'DELETE', headers: { 'X-Tenant-Id': getTenantId() } })
  if (!response.ok) throw await failure(response)
}

/** "(88) 99838-8079" → "5588998388079", pronto para wa.me. Vazio quando não há telefone. */
export function whatsappNumber(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (!digits) return ''
  return digits.startsWith('55') && digits.length >= 12 ? digits : `55${digits}`
}

/** Máscara de exibição brasileira: (88) 99838-8079. */
export function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '').replace(/^55(?=\d{10,11}$)/, '')
  if (digits.length === 11) return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
  if (digits.length === 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return phone
}
