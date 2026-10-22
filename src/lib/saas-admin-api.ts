import type { PlanKey } from '@/lib/plan-access'

export type PlanConfig = {
  key: PlanKey
  price: number
  active: boolean
  description: string
}

const planConfigsKey = 'vaija.saas.planConfigs'
export const planConfigsUpdatedEvent = 'vaija.saas.planConfigs.updated'

const defaultPlanConfigs: PlanConfig[] = [
  { key: 'Free', price: 0, active: true, description: 'Plano gratuito para começar com pedidos online e configuração básica.' },
  { key: 'Start', price: 79, active: true, description: 'Entrada para pedido online e operação simples.' },
  { key: 'Pro', price: 149, active: true, description: 'Operação com painel, PDV, pedidos e cardápio.' },
  { key: 'Premium', price: 249, active: true, description: 'Gestão completa com operador, controle de ingredientes e relatórios.' },
]

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
