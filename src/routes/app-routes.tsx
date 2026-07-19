import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'

const LandingPage = lazy(() => import('@/pages/landing/landing-page').then((module) => ({ default: module.LandingPage })))
const LoginPage = lazy(() => import('@/pages/login/login-page').then((module) => ({ default: module.LoginPage })))
const DashboardPage = lazy(() => import('@/pages/dashboard/dashboard-page').then((module) => ({ default: module.DashboardPage })))
const OrdersPage = lazy(() => import('@/pages/orders/orders-page').then((module) => ({ default: module.OrdersPage })))
const PosPage = lazy(() => import('@/pages/pos/pos-page').then((module) => ({ default: module.PosPage })))
const MenuPage = lazy(() => import('@/pages/menu/menu-page').then((module) => ({ default: module.MenuPage })))
const ReportsPage = lazy(() => import('@/pages/reports/reports-page').then((module) => ({ default: module.ReportsPage })))
const SettingsPage = lazy(() => import('@/pages/settings/settings-page').then((module) => ({ default: module.SettingsPage })))

export function AppRoutes() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center bg-background text-sm font-medium text-slate-500">Carregando Vaija...</div>}>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/pos" element={<PosPage />} />
        <Route path="/menu" element={<MenuPage />} />
        <Route path="/reports" element={<ReportsPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}
