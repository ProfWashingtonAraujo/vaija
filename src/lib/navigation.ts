import type { AuthUser } from '@/lib/auth-api'
import { getPlanHomePath } from '@/lib/plan-access'
import { getTenantForUser } from '@/lib/tenants-api'

export function getHomePathForUser(user: Pick<AuthUser, 'roleKey' | 'restaurantId' | 'email' | 'isPlatformAdmin'> | null | undefined) {
  if (user?.isPlatformAdmin) {
    return '/saas'
  }

  return getPlanHomePath(getTenantForUser(user).plan, user?.roleKey)
}
