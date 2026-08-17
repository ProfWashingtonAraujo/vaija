import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { ProtectedRoute } from '@/routes/protected-route'
import { getHomePathForUser } from '@/lib/navigation'

const LandingPage = lazy(() => import('@/pages/landing/landing-page').then((module) => ({ default: module.LandingPage })))
const PlanCheckoutPage = lazy(() => import('@/pages/plan-checkout/plan-checkout-page').then((module) => ({ default: module.PlanCheckoutPage })))
const LoginPage = lazy(() => import('@/pages/login/login-page').then((module) => ({ default: module.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard/dashboard-page').then((module) => ({ default: module.DashboardPage })))
const OperatorPage = lazy(() => import('@/pages/operator/operator-page').then((module) => ({ default: module.OperatorPage })))
const OrdersPage = lazy(() => import('@/pages/orders/orders-page').then((module) => ({ default: module.OrdersPage })))
const PosPage = lazy(() => import('@/pages/pos/pos-page').then((module) => ({ default: module.PosPage })))
const MenuPage = lazy(() => import('@/pages/menu/menu-page').then((module) => ({ default: module.MenuPage })))
const InventoryPage = lazy(() => import('@/pages/inventory/inventory-page').then((module) => ({ default: module.InventoryPage })))
const ReportsPage = lazy(() => import('@/pages/reports/reports-page').then((module) => ({ default: module.ReportsPage })))
const SettingsPage = lazy(() => import('@/pages/settings/settings-page').then((module) => ({ default: module.SettingsPage })))
const ActivationPage = lazy(() => import('@/pages/activation/activation-page').then((module) => ({ default: module.ActivationPage })))
const CustomerOrderPage = lazy(() => import('@/pages/customer-order/customer-order-page').then((module) => ({ default: module.CustomerOrderPage })))
const CustomerCheckoutPage = lazy(() => import('@/pages/customer-order/customer-checkout-page').then((module) => ({ default: module.CustomerCheckoutPage })))
const CustomerTrackingPage = lazy(() => import('@/pages/customer-order/customer-tracking-page').then((module) => ({ default: module.CustomerTrackingPage })))

export function AppRoutes() {
  const { user, isAuthenticated } = useAuth()

  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-sm font-medium text-slate-500">Carregando Vaija...</div>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/comprar" element={<PlanCheckoutPage />} />
        <Route path="/pedido" element={<CustomerOrderPage />} />
        <Route path="/pedido/checkout" element={<CustomerCheckoutPage />} />
        <Route path="/pedido/acompanhar" element={<CustomerTrackingPage />} />
        <Route path="/pedido/:tenantId" element={<CustomerOrderPage />} />
        <Route path="/pedido/:tenantId/checkout" element={<CustomerCheckoutPage />} />
        <Route path="/pedido/:tenantId/acompanhar" element={<CustomerTrackingPage />} />
        <Route path="/login" element={isAuthenticated ? <Navigate to={getHomePathForUser(user)} replace /> : <LoginPage />} />
        <Route element={<ProtectedRoute allowedRoles={['operator']} allowedPlans={['Premium']} />}>
          <Route path="/operator" element={<OperatorPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} allowedPlans={['Pro', 'Premium']} />}>
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/menu" element={<MenuPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} allowedPlans={['Premium']} />}>
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/reports" element={<ReportsPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['admin', 'manager']} allowedPlans={['Free', 'Start', 'Pro', 'Premium']} />}>
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['admin']} allowedPlans={['Free', 'Start', 'Pro', 'Premium']} />}>
          <Route path="/activation" element={<Navigate to="/saas" replace />} />
          <Route path="/saas" element={<ActivationPage />} />
          <Route path="/saas/:view" element={<ActivationPage />} />
          <Route path="/saas/clientes/:tenantId" element={<ActivationPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['admin', 'manager', 'operator']} allowedPlans={['Free', 'Start', 'Pro', 'Premium']} />}>
          <Route path="/orders" element={<OrdersPage />} />
        </Route>
        <Route element={<ProtectedRoute allowedRoles={['admin', 'manager', 'operator']} allowedPlans={['Pro', 'Premium']} />}>
          <Route path="/pos" element={<PosPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
