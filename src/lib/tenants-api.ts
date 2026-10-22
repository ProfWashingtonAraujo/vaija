import { apiFetch } from '@/lib/api-client'
import type { BusinessType } from '@/lib/business-types'
import type { PlanKey } from '@/lib/plan-access'

export type TenantStatus = 'active' | 'inactive'

export type Tenant = {
  id: string
  restaurantName: string
  ownerName: string
  email: string
  phone: string
  city: string
  businessType: BusinessType
  plan: PlanKey
  status: TenantStatus
  createdAt: string | null
}

export type TenantInput = Omit<Tenant, 'id' | 'createdAt'>

/** Enquanto o cadastro não chega do servidor: sem plano pago, sem nome. */
export const placeholderTenant: Tenant = {
  id: '',
  restaurantName: '',
  ownerName: '',
  email: '',
  phone: '',
  city: '',
  businessType: 'pizzeria',
  plan: 'Free',
  status: 'active',
  createdAt: null,
}

/** Código de erro devolvido pelo backend ({ ok: false, error }). */
export class TenantsError extends Error {
  code: string

  constructor(code: string) {
    super(code)
    this.code = code
  }
}

const jsonHeaders = { 'Content-Type': 'application/json' }

async function readJson<T>(response: Response) {
  const data = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new TenantsError(data.error ?? `tenants_request_failed:${response.status}`)
  return data
}

export async function fetchTenants() {
  return (await readJson<{ tenants: Tenant[] }>(await apiFetch('/api/platform/tenants'))).tenants
}

export async function fetchMyTenant() {
  return (await readJson<{ tenant: Tenant }>(await apiFetch('/api/tenant/me'))).tenant
}

export async function createTenant(input: TenantInput) {
  return (await readJson<{ tenant: Tenant }>(await apiFetch('/api/platform/tenants', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }))).tenant
}

export async function updateTenant(id: string, values: Partial<Pick<Tenant, 'restaurantName' | 'ownerName' | 'email' | 'phone' | 'city' | 'plan' | 'status'>>) {
  return (await readJson<{ tenant: Tenant }>(await apiFetch(`/api/platform/tenants/${encodeURIComponent(id)}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify(values) }))).tenant
}

export async function deleteTenant(id: string) {
  await readJson<object>(await apiFetch(`/api/platform/tenants/${encodeURIComponent(id)}`, { method: 'DELETE' }))
}

const legacyTenantsKey = 'vaija.tenants'
const legacyImportedKey = 'vaija.tenants.importedToServer'
const legacyPlatformId = 'vaija-saas'

/** A loja padrão se chamava 'taperas-pizzaria' no navegador e 'default' no servidor. */
const legacyIdAliases: Record<string, string> = { 'taperas-pizzaria': 'default' }

/** Falso depois que os clientes do navegador foram enviados ao servidor (nesta máquina). */
export function needsLegacyImport() {
  try {
    return !localStorage.getItem(legacyImportedKey)
  } catch {
    return true
  }
}

/** Clientes que o dono cadastrou antes de existir cadastro no servidor (só existem neste navegador). */
export function readLegacyTenants(): Tenant[] {
  try {
    if (localStorage.getItem(legacyImportedKey)) return []
    const stored = localStorage.getItem(legacyTenantsKey)
    if (!stored) return []
    return (JSON.parse(stored) as Tenant[])
      .filter((tenant) => tenant.id !== legacyPlatformId)
      .map((tenant) => ({ ...tenant, id: legacyIdAliases[tenant.id] ?? tenant.id }))
  } catch {
    return []
  }
}

let importInFlight: Promise<{ imported: number; registeredFromUsers: number }> | null = null

/** Envia os clientes do navegador ao servidor (ele também registra as lojas que já têm acesso). */
export function importLegacyTenants(tenants: Tenant[]) {
  // Chamadas ao mesmo tempo (o React executa o carregamento duas vezes em desenvolvimento) viram uma só.
  importInFlight ??= sendLegacyTenants(tenants).finally(() => {
    importInFlight = null
  })
  return importInFlight
}

async function sendLegacyTenants(tenants: Tenant[]) {
  const result = await readJson<{ imported: number; registeredFromUsers: number }>(
    await apiFetch('/api/platform/tenants/import', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ tenants }) }),
  )
  try {
    localStorage.setItem(legacyImportedKey, '1')
  } catch {
    // sem armazenamento: tenta de novo na próxima visita, o servidor ignora o que já existe
  }
  return result
}

const errorMessages: Record<string, string> = {
  invalid_business_type: 'Tipo de negócio inválido.',
  tenant_not_found: 'Cliente não encontrado.',
  cannot_delete_platform_tenant: 'A conta da plataforma não pode ser excluída.',
  gateway_rejected: 'Não foi possível cancelar a cobrança no Asaas. O cliente não foi excluído.',
  gateway_unavailable: 'Não conseguimos falar com o Asaas agora. O cliente não foi excluído.',
}

export function tenantErrorMessage(error: unknown, fallback: string) {
  return errorMessages[error instanceof TenantsError ? error.code : ''] ?? fallback
}
