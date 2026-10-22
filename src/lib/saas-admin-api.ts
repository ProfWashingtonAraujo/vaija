import type { PlanKey } from '@/lib/plan-access'

export type SaasAuditLog = {
  id: number
  action: string
  target: string
  actor: string
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

const auditLogsKey = 'vaija.saas.auditLogs'
const saasSettingsKey = 'vaija.saas.settings'
const planConfigsKey = 'vaija.saas.planConfigs'
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
  { key: 'Premium', price: 249, active: true, description: 'Gestão completa com operador, controle de ingredientes e relatórios.' },
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
