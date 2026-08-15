import type { AuthUser } from '@/lib/auth-api'
import type { PlanKey } from '@/lib/plan-access'
import { platformTenantId } from '@/lib/tenant-storage'

export type TenantStatus = 'active' | 'inactive'

export type Tenant = {
  id: string
  restaurantName: string
  ownerName: string
  email: string
  phone: string
  city: string
  plan: PlanKey
  status: TenantStatus
  createdAt: string
}

const tenantsKey = 'vaija.tenants'
export const defaultTenantId = 'taperas-pizzaria'
export const tenantsUpdatedEvent = 'vaija.tenants.updated'

const platformTenant: Tenant = {
  id: platformTenantId,
  restaurantName: 'Vaija Administração SaaS',
  ownerName: 'Washington',
  email: 'admin@vaija.com.br',
  phone: '(11) 4002-8922',
  city: 'Sao Paulo/SP',
  plan: 'Premium',
  status: 'active',
  createdAt: new Date(0).toISOString(),
}

const defaultTenant: Tenant = {
  id: defaultTenantId,
  restaurantName: 'Taperas Pizzaria',
  ownerName: 'Washington',
  email: 'contato@taperaspizzaria.com.br',
  phone: '(11) 4002-8922',
  city: 'Sao Paulo/SP',
  plan: 'Premium',
  status: 'active',
  createdAt: new Date(0).toISOString(),
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function ensurePlatformTenant(tenants: Tenant[]) {
  let nextTenants = tenants

  if (!nextTenants.some((tenant) => tenant.id === platformTenantId)) {
    nextTenants = [platformTenant, ...nextTenants]
  }

  return nextTenants
}

export function readTenants() {
  const storedTenants = localStorage.getItem(tenantsKey)
  if (!storedTenants) {
    localStorage.setItem(tenantsKey, JSON.stringify([platformTenant, defaultTenant]))
    return [platformTenant, defaultTenant]
  }

  const tenants = ensurePlatformTenant(JSON.parse(storedTenants) as Tenant[])
  localStorage.setItem(tenantsKey, JSON.stringify(tenants))
  return tenants
}

export function saveTenants(tenants: Tenant[]) {
  localStorage.setItem(tenantsKey, JSON.stringify(tenants))
  window.dispatchEvent(new CustomEvent(tenantsUpdatedEvent, { detail: tenants }))
}

export function getTenantForUser(user: Pick<AuthUser, 'restaurantId' | 'email'> | null | undefined) {
  const tenants = readTenants()
  return tenants.find((tenant) => tenant.id === user?.restaurantId) ?? tenants.find((tenant) => tenant.email.toLowerCase() === user?.email.toLowerCase()) ?? tenants[0]
}

export function createTenant(input: Omit<Tenant, 'id' | 'createdAt'>) {
  const tenants = readTenants()
  const baseId = slugify(input.restaurantName) || `cliente-${Date.now()}`
  let id = baseId
  let suffix = 2

  while (tenants.some((tenant) => tenant.id === id)) {
    id = `${baseId}-${suffix}`
    suffix += 1
  }

  const tenant: Tenant = {
    ...input,
    id,
    createdAt: new Date().toISOString(),
  }

  saveTenants([tenant, ...tenants])
  return tenant
}

export function updateTenant(id: string, values: Partial<Omit<Tenant, 'id' | 'createdAt'>>) {
  const tenants = readTenants()
  const nextTenants = tenants.map((tenant) => tenant.id === id ? { ...tenant, ...values } : tenant)
  saveTenants(nextTenants)
  return nextTenants.find((tenant) => tenant.id === id)
}

export function deleteTenant(id: string) {
  if (id === platformTenantId) {
    throw new Error('cannot_delete_platform_tenant')
  }
  const tenants = readTenants()
  const tenant = tenants.find((current) => current.id === id)
  if (!tenant) {
    throw new Error('tenant_not_found')
  }
  saveTenants(tenants.filter((current) => current.id !== id))
  return tenant
}
