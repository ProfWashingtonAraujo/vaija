import type { PlanKey } from '@/lib/plan-access'
import type { PlanConfig } from '@/lib/saas-api'

export type PricingPlan = {
  name: PlanKey
  /** Preço já formatado, vindo do servidor. */
  price: string
  /** Texto vindo do servidor. */
  description: string
  cta: string
  highlight?: boolean
  badge?: string
  screens: string[]
  features: string[]
}

/** Só o que é de vendas e não tem número: telas e benefícios. Preço, texto e disponibilidade vêm do servidor. */
export const pricingPlans: Omit<PricingPlan, 'price' | 'description'>[] = [
  {
    name: 'Free',
    cta: 'Começar grátis',
    screens: [
      'Pedidos online',
      'Checkout do cliente',
      'Acompanhamento do pedido',
      'Configurações básicas',
    ],
    features: [
      'Pedido online básico',
      'Cadastro inicial do restaurante',
      'Até 1 usuário',
      'Sem mensalidade',
      'Upgrade quando precisar',
    ],
  },
  {
    name: 'Start',
    cta: 'Começar no Start',
    screens: [
      'Cardápio online',
      'Pedidos online',
      'Checkout do cliente',
      'Acompanhamento do pedido',
      'Configurações básicas',
    ],
    features: [
      'Gestão básica de pedidos',
      'Cardápio digital',
      'Até 2 usuários',
      'Relatório simples de vendas',
      'Suporte por e-mail',
      'Layout responsivo',
    ],
  },
  {
    name: 'Pro',
    cta: 'Assinar Plano Pro',
    highlight: true,
    badge: 'Mais escolhido',
    screens: [
      'Painel geral',
      'Pedidos',
      'PDV',
      'Cardápio',
      'Cardápio online',
      'Checkout do cliente',
      'Configurações',
    ],
    features: [
      'Tudo do plano Start',
      'PDV completo',
      'Kanban de pedidos',
      'Relatórios inteligentes',
      'Até 6 usuários',
      'Controle de caixa',
      'Métodos de pagamento',
      'Suporte prioritario',
    ],
  },
  {
    name: 'Premium',
    cta: 'Quero o Premium',
    screens: [
      'Painel geral',
      'Área do operador',
      'Pedidos',
      'PDV',
      'Cardápio',
      'Ingredientes em falta',
      'Relatórios',
      'Configurações',
      'Cardápio online',
      'Checkout do cliente',
    ],
    features: [
      'Tudo do plano Pro',
      'Usuários ilimitados',
      'Relatórios avançados',
      'Gestão de permissões',
      'Multiunidade em preparacao',
      'Painel geral executivo',
      'Atendimento prioritario',
      'Consultoria inicial',
    ],
  },
]

export function formatPlanPrice(price: number) {
  if (price === 0) return 'Grátis'
  const value = Number.isInteger(price) ? String(price) : price.toFixed(2).replace('.', ',')
  return `R$ ${value}/mês`
}

/** Junta o que é de vendas com o catálogo do servidor (preço, descrição e se o plano aparece). */
export function getPricingPlans(planConfigs: PlanConfig[]): PricingPlan[] {
  const plans = pricingPlans.flatMap((plan) => {
    const config = planConfigs.find((item) => item.key === plan.name)
    return config ? [{ plan: { ...plan, price: formatPlanPrice(config.price), description: config.description }, active: config.active }] : []
  })
  const visible = plans.filter((item) => item.active)
  return (visible.length ? visible : plans).map((item) => item.plan)
}
