import { apiFetch } from '@/lib/api-client'
import type { PlanKey } from '@/lib/plan-access'

export type LeadStatus = 'Novo' | 'Contatado' | 'Convertido' | 'Perdido'

export type Lead = {
  id: number
  plan: PlanKey
  restaurantName: string
  ownerName: string
  phone: string
  email: string
  city: string
  notes: string
  status: LeadStatus
  createdAt: string
}

export type LeadInput = Pick<Lead, 'plan' | 'restaurantName' | 'ownerName' | 'phone' | 'email' | 'city'> & { notes?: string }

export type SaasAuditLog = {
  id: number
  action: string
  target: string
  actor: string
  createdAt: string
}

const jsonHeaders = { 'Content-Type': 'application/json' }

async function readJson<T>(response: Response) {
  if (!response.ok) throw new Error(`saas_request_failed:${response.status}`)
  return await response.json() as T
}

/** Formulário público da página de vendas: não exige login. */
export async function submitLead(input: LeadInput) {
  const response = await apiFetch('/api/public/leads', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }, false)
  if (response.status === 429) throw new Error('too_many_requests')
  if (!response.ok) throw new Error(`saas_request_failed:${response.status}`)
}

export async function fetchLeads() {
  return (await readJson<{ leads: Lead[] }>(await apiFetch('/api/platform/leads'))).leads
}

export async function updateLeadStatus(id: number, status: LeadStatus) {
  return (await readJson<{ lead: Lead }>(await apiFetch(`/api/platform/leads/${id}`, { method: 'PATCH', headers: jsonHeaders, body: JSON.stringify({ status }) }))).lead
}

export async function deleteLead(id: number) {
  await readJson<object>(await apiFetch(`/api/platform/leads/${id}`, { method: 'DELETE' }))
}

export async function fetchAuditLogs() {
  return (await readJson<{ logs: SaasAuditLog[] }>(await apiFetch('/api/platform/audit'))).logs
}

export async function addAuditLog(action: string, target: string) {
  return (await readJson<{ log: SaasAuditLog }>(await apiFetch('/api/platform/audit', { method: 'POST', headers: jsonHeaders, body: JSON.stringify({ action, target }) }))).log
}

export type PlanConfig = {
  key: PlanKey
  price: number
  active: boolean
  description: string
}

/** Valores de partida enquanto o catálogo não chega do servidor (o servidor tem os mesmos padrões). */
export const defaultPlanConfigs: PlanConfig[] = [
  { key: 'Free', price: 0, active: true, description: 'Plano gratuito para começar com pedidos online e configuração básica.' },
  { key: 'Start', price: 79, active: true, description: 'Entrada para pedido online e operação simples.' },
  { key: 'Pro', price: 149, active: true, description: 'Operação com painel, PDV, pedidos e cardápio.' },
  { key: 'Premium', price: 249, active: true, description: 'Gestão completa com operador, controle de ingredientes e relatórios.' },
]

/** Preços e textos dos planos, públicos: a página de vendas e o checkout usam os mesmos valores da cobrança. */
export async function fetchPlanConfigs() {
  return (await readJson<{ plans: PlanConfig[] }>(await apiFetch('/api/public/plans', undefined, false))).plans
}

export async function savePlanConfigs(plans: PlanConfig[]) {
  return (await readJson<{ plans: PlanConfig[] }>(await apiFetch('/api/platform/plans', { method: 'PUT', headers: jsonHeaders, body: JSON.stringify({ plans }) }))).plans
}
