import type { AuthUser } from '@/lib/auth-api'

const localSessionKey = 'vaija.localSession'

export const platformTenantId = 'vaija-saas'
export const defaultTenantStorageId = 'taperas-pizzaria'

export function getCurrentTenantId() {
  const storedSession = localStorage.getItem(localSessionKey)

  if (!storedSession) {
    return defaultTenantStorageId
  }

  const session = JSON.parse(storedSession) as Pick<AuthUser, 'restaurantId'>
  return session.restaurantId || defaultTenantStorageId
}

export function getTenantStorageKey(key: string, tenantId = getCurrentTenantId()) {
  return `${key}.${tenantId}`
}

export function readTenantStorage<T>(key: string, fallback: T) {
  const scopedKey = getTenantStorageKey(key)
  const storedValue = localStorage.getItem(scopedKey)

  if (storedValue) {
    return JSON.parse(storedValue) as T
  }

  const legacyValue = localStorage.getItem(key)
  if (legacyValue) {
    localStorage.setItem(scopedKey, legacyValue)
    return JSON.parse(legacyValue) as T
  }

  localStorage.setItem(scopedKey, JSON.stringify(fallback))
  return fallback
}

export function writeTenantStorage<T>(key: string, value: T) {
  localStorage.setItem(getTenantStorageKey(key), JSON.stringify(value))
}

export function readTenantFlag(key: string) {
  const scopedKey = getTenantStorageKey(key)
  const storedValue = localStorage.getItem(scopedKey)

  if (storedValue) {
    return storedValue
  }

  const legacyValue = localStorage.getItem(key)
  if (legacyValue) {
    localStorage.setItem(scopedKey, legacyValue)
  }

  return legacyValue
}

export function writeTenantFlag(key: string, value: string) {
  localStorage.setItem(getTenantStorageKey(key), value)
}
