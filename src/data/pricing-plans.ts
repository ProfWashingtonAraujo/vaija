import { readPlanConfigs } from '@/lib/saas-admin-api'

export const pricingPlans = [
  {
    name: 'Free',
    price: 'R$ 0/mes',
    description: 'Para testar o Vaija e receber os primeiros pedidos online sem custo mensal.',
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
    price: 'R$ 79/mes',
    description: 'Para pequenos negócios que querem organizar pedidos e cardápio.',
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
    price: 'R$ 149/mes',
    description: 'Para restaurantes que precisam de PDV, delivery e relatórios completos.',
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
    price: 'R$ 249/mes',
    description: 'Para operações maiores que precisam de controle avançado e visão estratégica.',
    cta: 'Quero o Premium',
    screens: [
      'Painel geral',
      'Área do operador',
      'Pedidos',
      'PDV',
      'Cardápio',
      'Estoque',
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

export function getPricingPlans() {
  const planConfigs = readPlanConfigs()

  const plans = pricingPlans.map((plan) => {
    const config = planConfigs.find((item) => item.key === plan.name)
    return {
      ...plan,
      price: config ? `R$ ${config.price}/mes` : plan.price,
      description: config?.description || plan.description,
      active: config?.active ?? true,
    }
  })

  const activePlans = plans.filter((plan) => plan.active)
  return activePlans.length ? activePlans : plans
}
