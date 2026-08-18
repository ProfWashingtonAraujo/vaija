export type PlanKey = 'Free' | 'Start' | 'Pro' | 'Premium'

export const planLabels: Record<PlanKey, string> = {
  Free: 'Plano Free',
  Start: 'Plano Start',
  Pro: 'Plano Pro',
  Premium: 'Plano Premium',
}

export const planRoutes: Record<PlanKey, string[]> = {
  Free: ['/orders', '/settings', '/activation'],
  Start: ['/orders', '/settings', '/activation'],
  Pro: ['/dashboard', '/orders', '/pos', '/menu', '/settings', '/activation'],
  Premium: ['/dashboard', '/operator', '/orders', '/pos', '/menu', '/inventory', '/reports', '/settings', '/activation'],
}

export function canAccessPath(plan: PlanKey, path: string) {
  if (path.startsWith('/saas') || path === '/activation') {
    return true
  }

  return planRoutes[plan].includes(path)
}

export function getPlanHomePath(plan: PlanKey, roleKey?: string) {
  if (plan === 'Premium' && roleKey === 'operator') {
    return '/operator'
  }

  return planRoutes[plan][0]
}
