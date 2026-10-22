import type { AuthUser } from '@/lib/auth-api'
import { getPlanHomePath } from '@/lib/plan-access'
import type { Tenant } from '@/lib/tenants-api'

export function getHomePathForUser(user: Pick<AuthUser, 'roleKey' | 'isPlatformAdmin'> | null | undefined, tenant: Pick<Tenant, 'plan'> | null | undefined) {
  if (user?.isPlatformAdmin) {
    return '/saas'
  }

  return getPlanHomePath(tenant?.plan ?? 'Free', user?.roleKey)
}
