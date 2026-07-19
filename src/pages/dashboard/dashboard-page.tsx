import { useEffect, useState } from 'react'
import { AdminLayout } from '@/components/layout/admin-layout'
import { MetricCard } from '@/components/dashboard/metric-card'
import { dashboardMetrics, categorySeries, revenueSeries } from '@/data/mock-dashboard'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { CategoryChart } from '@/components/dashboard/category-chart'
import { LatestOrdersTable } from '@/components/dashboard/latest-orders-table'
import { orders } from '@/data/mock-orders'

export function DashboardPage() {
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => setLoaded(true), 500)
    return () => window.clearTimeout(timer)
  }, [])

  return (
    <AdminLayout title="Dashboard Geral" description="Bem-vindo de volta, Taperas Pizzaria. Aqui esta o resumo de hoje.">
      {!loaded ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-[28px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5]" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dashboardMetrics.map((metric) => (
              <MetricCard key={metric.label} label={metric.label} value={metric.value} trend={metric.trend} icon={metric.icon} currency={metric.label !== 'Novos pedidos'} />
            ))}
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"><h3 className="font-heading text-xl font-bold text-slate-900">Faturamento semanal</h3><div className="mt-5 rounded-[24px] border border-orange-100 bg-white/80 p-3"><RevenueChart data={revenueSeries} /></div></div>
            <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"><h3 className="font-heading text-xl font-bold text-slate-900">Vendas por categoria</h3><div className="mt-5 rounded-[24px] border border-orange-100 bg-white/80 p-3"><CategoryChart data={categorySeries} /></div></div>
          </div>
          <div className="mt-6"><LatestOrdersTable orders={orders.slice(0, 4)} /></div>
        </>
      )}
    </AdminLayout>
  )
}
