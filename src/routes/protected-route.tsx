import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { getHomePathForUser } from '@/lib/navigation'
import { canAccessPath, type PlanKey } from '@/lib/plan-access'
import { getTenantForUser } from '@/lib/tenants-api'

export function ProtectedRoute({ allowedRoles, allowedPlans }: { allowedRoles?: string[]; allowedPlans?: PlanKey[] }) {
  const { user, isAuthenticated, isLoading } = useAuth()
  const location = useLocation()
  const tenant = getTenantForUser(user)
  const currentPlan = tenant.plan

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm font-medium text-slate-500">Validando sessão...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  if (allowedRoles && (!user || !allowedRoles.includes(user.roleKey))) {
    return <Navigate to={getHomePathForUser(user)} replace />
  }

  if (user?.isPlatformAdmin && !location.pathname.startsWith('/saas') && location.pathname !== '/activation') {
    return <Navigate to="/saas" replace />
  }

  if ((location.pathname.startsWith('/saas') || location.pathname === '/activation') && !user?.isPlatformAdmin) {
    return <Navigate to={getHomePathForUser(user)} replace />
  }

  if (tenant.status !== 'active' && !location.pathname.startsWith('/saas') && location.pathname !== '/activation') {
    return <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center"><div className="max-w-md rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"><h1 className="font-heading text-2xl font-bold text-slate-900">Assinatura inativa</h1><p className="mt-3 text-sm leading-6 text-slate-500">O acesso deste restaurante está pausado. Fale com o comercial para reativar o plano.</p></div></div>
  }

  if ((allowedPlans && !allowedPlans.includes(currentPlan)) || !canAccessPath(currentPlan, location.pathname)) {
    return <Navigate to={getHomePathForUser(user)} replace />
  }

  return <Outlet />
}
