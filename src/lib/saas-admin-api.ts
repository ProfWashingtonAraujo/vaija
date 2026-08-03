import type { PlanKey } from '@/lib/plan-access'
import type { Tenant } from '@/lib/tenants-api'

export type SaasAuditLog = {
  id: number
  action: string
  target: string
  actor: string
  createdAt: string
}

export type SupportTicket = {
  id: number
  tenantId: string
  subject: string
  priority: 'Baixa' | 'Média' | 'Alta'
  status: 'Aberto' | 'Em atendimento' | 'Resolvido'
  createdAt: string
}

export type SaasSettings = {
  companyName: string
  salesWhatsapp: string
  defaultTrialDays: number
  overdueGraceDays: number
  defaultWelcomeMessage: string
}

export type PlanConfig = {
  key: PlanKey
  price: number
  active: boolean
  description: string
}

export type BillingStatus = 'paid' | 'open' | 'overdue' | 'cancelled'

export type BillingInvoice = {
  id: string
  tenantId: string
  referenceMonth: string
  amount: number
  status: BillingStatus
  dueDate: string
  paidAt?: string
  createdAt: string
}

const auditLogsKey = 'vaija.saas.auditLogs'
const supportTicketsKey = 'vaija.saas.supportTickets'
const saasSettingsKey = 'vaija.saas.settings'
const planConfigsKey = 'vaija.saas.planConfigs'
const billingInvoicesKey = 'vaija.saas.billingInvoices'
export const planConfigsUpdatedEvent = 'vaija.saas.planConfigs.updated'

const defaultSettings: SaasSettings = {
  companyName: 'Vaija',
  salesWhatsapp: '5599999999999',
  defaultTrialDays: 7,
  overdueGraceDays: 3,
  defaultWelcomeMessage: 'Bem-vindo ao Vaija! Seu acesso administrativo foi criado.',
}

const defaultPlanConfigs: PlanConfig[] = [
  { key: 'Free', price: 0, active: true, description: 'Plano gratuito para começar com pedidos online e configuração básica.' },
  { key: 'Start', price: 79, active: true, description: 'Entrada para pedido online e operação simples.' },
  { key: 'Pro', price: 149, active: true, description: 'Operação com painel, PDV, pedidos e cardápio.' },
  { key: 'Premium', price: 249, active: true, description: 'Gestão completa com operador, estoque e relatórios.' },
]

function readList<T>(key: string) {
  const stored = localStorage.getItem(key)
  return stored ? JSON.parse(stored) as T[] : []
}

function writeList<T>(key: string, items: T[]) {
  localStorage.setItem(key, JSON.stringify(items))
}

export function readAuditLogs() {
  return readList<SaasAuditLog>(auditLogsKey)
}

export function addAuditLog(input: Omit<SaasAuditLog, 'id' | 'createdAt'>) {
  const logs = readAuditLogs()
  const log: SaasAuditLog = {
    id: Math.max(0, ...logs.map((item) => item.id)) + 1,
    ...input,
    createdAt: new Date().toISOString(),
  }
  writeList(auditLogsKey, [log, ...logs])
  return log
}

export function readSupportTickets() {
  return readList<SupportTicket>(supportTicketsKey)
}

export function createSupportTicket(input: Omit<SupportTicket, 'id' | 'createdAt'>) {
  const tickets = readSupportTickets()
  const ticket: SupportTicket = {
    id: Math.max(0, ...tickets.map((item) => item.id)) + 1,
    ...input,
    createdAt: new Date().toISOString(),
  }
  writeList(supportTicketsKey, [ticket, ...tickets])
  return ticket
}

export function updateSupportTicket(id: number, values: Partial<Pick<SupportTicket, 'status' | 'priority'>>) {
  const tickets = readSupportTickets().map((ticket) => ticket.id === id ? { ...ticket, ...values } : ticket)
  writeList(supportTicketsKey, tickets)
  return tickets
}

export function readSaasSettings() {
  const stored = localStorage.getItem(saasSettingsKey)
  return stored ? { ...defaultSettings, ...JSON.parse(stored) as Partial<SaasSettings> } : defaultSettings
}

export function saveSaasSettings(settings: SaasSettings) {
  localStorage.setItem(saasSettingsKey, JSON.stringify(settings))
}

export function readPlanConfigs() {
  const stored = localStorage.getItem(planConfigsKey)
  if (!stored) {
    return defaultPlanConfigs
  }

  const configs = JSON.parse(stored) as PlanConfig[]
  const configsWithDefaults = defaultPlanConfigs.map((defaultConfig) => configs.find((config) => config.key === defaultConfig.key) ?? defaultConfig)
  return configsWithDefaults
}

export function savePlanConfigs(configs: PlanConfig[]) {
  localStorage.setItem(planConfigsKey, JSON.stringify(configs))
  window.dispatchEvent(new CustomEvent(planConfigsUpdatedEvent, { detail: configs }))
}

export function readBillingInvoices() {
  return readList<BillingInvoice>(billingInvoicesKey)
}

export function saveBillingInvoices(invoices: BillingInvoice[]) {
  writeList(billingInvoicesKey, invoices)
}

export function syncCurrentBillingInvoices(tenants: Tenant[], planPrices: Record<PlanKey, number>) {
  const invoices = readBillingInvoices()
  const referenceMonth = new Date().toISOString().slice(0, 7)
  const existingKeys = new Set(invoices.map((invoice) => `${invoice.tenantId}:${invoice.referenceMonth}`))
  const nextInvoices = [...invoices]

  for (const tenant of tenants) {
    const key = `${tenant.id}:${referenceMonth}`
    if (existingKeys.has(key)) {
      continue
    }

    const dueDate = new Date()
    dueDate.setDate(10)

    nextInvoices.unshift({
      id: `${tenant.id}-${referenceMonth}`,
      tenantId: tenant.id,
      referenceMonth,
      amount: planPrices[tenant.plan],
      status: tenant.status === 'active' ? 'open' : 'cancelled',
      dueDate: dueDate.toISOString(),
      createdAt: new Date().toISOString(),
    })
  }

  saveBillingInvoices(nextInvoices)
  return nextInvoices
}

export function updateBillingInvoice(id: string, values: Partial<Pick<BillingInvoice, 'status' | 'paidAt'>>) {
  const invoices = readBillingInvoices().map((invoice) => invoice.id === id ? { ...invoice, ...values } : invoice)
  saveBillingInvoices(invoices)
  return invoices
}
