import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { MetricCard } from '@/components/dashboard/metric-card'
import { RevenueChart } from '@/components/dashboard/revenue-chart'
import { CategoryChart } from '@/components/dashboard/category-chart'
import { LatestOrdersTable } from '@/components/dashboard/latest-orders-table'
import { orders as mockOrders, type Order } from '@/data/mock-orders'
import { products as mockProducts, type Product } from '@/data/mock-products'
import { fetchProducts } from '@/lib/catalog-api'
import { fetchOrders } from '@/lib/orders-api'
import { readSettings } from '@/lib/settings'

function getItemName(item: string) {
  return item.replace(/^\d+x\s+/, '')
}

function getRevenuePeriod(time: string) {
  const hour = Number(time.split(':')[0])
  if (Number.isNaN(hour)) {
    return 'Agora'
  }

  return `${String(hour).padStart(2, '0')}h`
}

function getDashboardData(orders: Order[], products: Product[]) {
  const validOrders = orders.filter((order) => order.status !== 'Cancelado')
  const totalRevenue = validOrders.reduce((sum, order) => sum + order.value, 0)
  const totalDeliveryFees = validOrders.reduce((sum, order) => sum + (order.deliveryFee ?? 0), 0)
  const averageTicket = validOrders.length > 0 ? totalRevenue / validOrders.length : 0
  const productCategoryByName = new Map(products.map((product) => [product.name, product.category]))
  const revenueByPeriod = new Map<string, number>()
  const salesByCategory = new Map<string, number>()

  validOrders.forEach((order) => {
    const period = getRevenuePeriod(order.time)
    revenueByPeriod.set(period, (revenueByPeriod.get(period) ?? 0) + order.value)

    order.items.forEach((item) => {
      const category = productCategoryByName.get(getItemName(item)) ?? 'Outros'
      salesByCategory.set(category, (salesByCategory.get(category) ?? 0) + 1)
    })
  })

  return {
    metrics: [
      { label: 'Vendas hoje', value: totalRevenue, trend: `${validOrders.length} pedidos vendidos`, icon: 'Wallet' as const, currency: true },
      { label: 'Novos pedidos', value: validOrders.length, trend: `${orders.filter((order) => order.status === 'Pendente').length} pendentes`, icon: 'Receipt' as const, currency: false },
      { label: 'Ticket médio', value: averageTicket, trend: 'Média por pedido', icon: 'ChartPie' as const, currency: true },
      { label: 'Taxa de entrega', value: totalDeliveryFees, trend: 'Total em entregas', icon: 'Bike' as const, currency: true },
    ],
    revenueSeries: Array.from(revenueByPeriod.entries()).map(([day, revenue]) => ({ day, revenue })),
    categorySeries: Array.from(salesByCategory.entries()).map(([name, value]) => ({ name, value })),
    latestOrders: validOrders.slice(0, 4),
  }
}

export function DashboardPage() {
  const [loaded, setLoaded] = useState(false)
  const [orders, setOrders] = useState<Order[]>(mockOrders)
  const [products, setProducts] = useState<Product[]>(mockProducts)
  const [restaurantSettings] = useState(() => readSettings().restaurant)

  useEffect(() => {
    void Promise.all([fetchOrders(), fetchProducts()])
      .then(([loadedOrders, loadedProducts]) => {
        setOrders(loadedOrders)
        setProducts(loadedProducts)
      })
      .catch(() => {
        toast.error('Não foi possível carregar os dados reais do painel.')
      })
      .finally(() => setLoaded(true))
  }, [])

  const dashboardData = getDashboardData(orders, products)

  return (
    <AdminLayout title="Painel Geral" description={`Bem-vindo de volta, ${restaurantSettings.name}. Aqui está o resumo de hoje.`}>
      {!loaded ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-40 animate-pulse rounded-[28px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5]" />)}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {dashboardData.metrics.map((metric) => (
              <MetricCard key={metric.label} label={metric.label} value={metric.value} trend={metric.trend} icon={metric.icon} currency={metric.currency} />
            ))}
          </div>
          <div className="mt-6 grid gap-6 xl:grid-cols-2">
            <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"><h3 className="font-heading text-xl font-bold text-slate-900">Faturamento de hoje</h3><div className="mt-5 rounded-[24px] border border-orange-100 bg-white/80 p-3"><RevenueChart data={dashboardData.revenueSeries} /></div></div>
            <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]"><h3 className="font-heading text-xl font-bold text-slate-900">Vendas por categoria</h3><div className="mt-5 rounded-[24px] border border-orange-100 bg-white/80 p-3"><CategoryChart data={dashboardData.categorySeries} /></div></div>
          </div>
          <div className="mt-6"><LatestOrdersTable orders={dashboardData.latestOrders} /></div>
        </>
      )}
    </AdminLayout>
  )
}
