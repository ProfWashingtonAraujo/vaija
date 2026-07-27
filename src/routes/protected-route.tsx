import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm font-medium text-slate-500">Validando sessao...</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
