import type { AuthUser } from '@/lib/auth-api'

const localSessionKey = 'vaija.localSession'

export const platformTenantId = 'vaija-saas'
export const defaultTenantStorageId = 'taperas-pizzaria'
export const defaultTenantId = 'default'

export function getCurrentTenantId() {
  const storedSession = localStorage.getItem(localSessionKey)

  if (!storedSession) {
    return defaultTenantStorageId
  }

  const session = JSON.parse(storedSession) as Pick<AuthUser, 'restaurantId'>
  return session.restaurantId || defaultTenantStorageId
}

export function getTenantId(): string {
  const storedSession = localStorage.getItem(localSessionKey)

  if (!storedSession) {
    return defaultTenantId
  }

  const session = JSON.parse(storedSession) as { tenantId?: string; restaurantId?: string }
  return session.tenantId || defaultTenantId
}

export function setTenantId(tenantId: string) {
  const storedSession = localStorage.getItem(localSessionKey)
  if (storedSession) {
    const session = JSON.parse(storedSession)
    session.tenantId = tenantId
    localStorage.setItem(localSessionKey, JSON.stringify(session))
  }
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

export function writeTenantStorage<T>(key: string, value: T, tenantId?: string) {
  localStorage.setItem(getTenantStorageKey(key, tenantId), JSON.stringify(value))
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

export function writeTenantFlag(key: string, value: string, tenantId?: string) {
  localStorage.setItem(getTenantStorageKey(key, tenantId), value)
}
