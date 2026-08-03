import { readTenantStorage, writeTenantStorage } from '@/lib/tenant-storage'

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

export function openCashRegister(userName: string) {
  const nextCashRegister: CashRegisterState = {
    isOpen: true,
    openedAt: new Date().toISOString(),
    openedBy: userName,
  }

  saveCashRegister(nextCashRegister)
  return nextCashRegister
}

export function closeCashRegister(userName: string) {
  const currentCashRegister = readCashRegister()
  const nextCashRegister: CashRegisterState = {
    ...currentCashRegister,
    isOpen: false,
    closedAt: new Date().toISOString(),
    closedBy: userName,
  }

  saveCashRegister(nextCashRegister)
  return nextCashRegister
}
