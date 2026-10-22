import { readTenantStorage, writeTenantStorage, getTenantId } from '@/lib/tenant-storage'
import { apiFetch } from '@/lib/api-client'

export type CashRegisterState = {
  isOpen: boolean
  openedAt?: string
  openedBy?: string
  closedAt?: string
  closedBy?: string
}

const cashRegisterKey = 'vaija.cashRegister'
export const cashRegisterUpdatedEvent = 'vaija:cash-register-updated'

const defaultCashRegister: CashRegisterState = {
  isOpen: false,
}

export function readCashRegister() {
  return readTenantStorage(cashRegisterKey, defaultCashRegister)
}

export function saveCashRegister(cashRegister: CashRegisterState) {
  writeTenantStorage(cashRegisterKey, cashRegister)
  window.dispatchEvent(new CustomEvent(cashRegisterUpdatedEvent, { detail: cashRegister }))
}

const offlineMode = import.meta.env.VITE_OFFLINE_MODE === 'true'

/**
 * O estado do caixa vive no servidor (por restaurante): o cliente, em outro navegador, precisa
 * enxergar se o restaurante está recebendo pedidos. O localStorage é só cache do painel.
 */
export async function fetchCashRegister(): Promise<CashRegisterState> {
  if (offlineMode) return readCashRegister()
  const response = await apiFetch('/api/cash-register', { headers: { 'X-Tenant-Id': getTenantId() } })
  if (!response.ok) throw new Error(`failed_to_fetch_cash_register:${response.status}`)
  const state = await response.json() as CashRegisterState
  saveCashRegister(state)
  return state
}

/** Consulta pública (sem login) usada pelo cardápio e pelo checkout do cliente. */
export async function fetchPublicCashRegisterOpen(tenantId: string): Promise<boolean> {
  if (offlineMode) return readCashRegister().isOpen
  const response = await apiFetch(`/api/public/${encodeURIComponent(tenantId)}/cash-register`, undefined, false)
  if (!response.ok) throw new Error(`failed_to_fetch_public_cash_register:${response.status}`)
  const data = await response.json() as { isOpen?: boolean }
  return Boolean(data.isOpen)
}
