import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { ReportKpiCard } from '@/components/reports/report-kpi-card'
import { ReportChartCard } from '@/components/reports/report-chart-card'
import { ProductsPerformanceTable } from '@/components/reports/products-performance-table'
import { Button } from '@/components/ui/button'
import type { Order } from '@/data/mock-orders'
import type { Product } from '@/data/mock-products'
import { fetchProducts } from '@/lib/catalog-api'
import { fetchOrders } from '@/lib/orders-api'
import { usePolling } from '@/lib/use-polling'
import { formatCurrency } from '@/lib/formatters'
import { buildReport, downloadCsv, printReport, reportPeriodLabels, reportToCsv, type ReportPeriod } from '@/lib/reports'

const pieColors = ['#ff6b00', '#ffb26b', '#ffd4ad', '#fed7aa', '#fdba74']
const emptyState = <div className="flex h-full items-center justify-center text-sm text-slate-500">Sem dados no período.</div>

export function ReportsPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [period, setPeriod] = useState<ReportPeriod>('7d')

  useEffect(() => {
    void Promise.all([fetchOrders(), fetchProducts()])
      .then(([loadedOrders, loadedProducts]) => {
        setOrders(loadedOrders)
        setProducts(loadedProducts)
      })
      .catch(() => toast.error('Não foi possível carregar os dados reais dos relatórios.'))
  }, [])

  usePolling(() => fetchOrders().then(setOrders).catch(() => undefined))

  const report = useMemo(() => buildReport(orders, products, period), [orders, products, period])
  const periodLabel = reportPeriodLabels[period]
  const kpis = [
    { label: 'Faturamento total', value: formatCurrency(report.revenue) },
    { label: 'Pedidos concluídos', value: String(report.completed) },
    { label: 'Cancelamentos', value: String(report.cancelled) },
    { label: 'Produto mais vendido', value: report.topProduct },
    { label: 'Horário de pico', value: report.peakHour },
  ]

  const exportCsv = () => {
    downloadCsv(reportToCsv(report, periodLabel), `relatorio-${period}-${new Date().toISOString().slice(0, 10)}.csv`)
    toast.success('Arquivo CSV gerado.')
  }
  const exportPdf = () => {
    if (!printReport(report, periodLabel)) toast.error('Permita pop-ups para exportar o PDF.')
  }

  return (
    <AdminLayout title="Relatórios Inteligentes" description="Indicadores reais dos seus pedidos, com filtro de período e exportação.">
      <div className="rounded-[30px] border border-orange-100 bg-gradient-to-r from-[#fffaf5] to-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Insights</p>
            <p className="mt-1 font-heading text-2xl font-bold text-slate-900">Exportações e leitura rápida dos indicadores</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <select value={period} onChange={(event) => setPeriod(event.target.value as ReportPeriod)} aria-label="Período" className="h-11 rounded-2xl border border-orange-200 bg-white/90 px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
              {(Object.keys(reportPeriodLabels) as ReportPeriod[]).map((key) => <option key={key} value={key}>{reportPeriodLabels[key]}</option>)}
            </select>
            <Button variant="outline" className="border-orange-200 bg-white/90" onClick={exportPdf}>Exportar PDF</Button>
            <Button variant="outline" className="border-orange-200 bg-white/90" onClick={exportCsv}>Exportar CSV</Button>
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {kpis.map((kpi) => <ReportKpiCard key={kpi.label} label={kpi.label} value={kpi.value} />)}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ReportChartCard title="Receita por dia">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={report.dailyRevenue}><XAxis dataKey="day" tickLine={false} axisLine={false} /><Tooltip formatter={(value: unknown) => formatCurrency(Number(value ?? 0))} /><Bar dataKey="value" fill="#ff6b00" radius={[10, 10, 0, 0]} /></BarChart></ResponsiveContainer>
        </ReportChartCard>
        <ReportChartCard title="Pedidos por status">
          {report.statusSeries.length === 0 ? emptyState : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={report.statusSeries} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95}>{report.statusSeries.map((entry, index) => <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>}
        </ReportChartCard>
        <ReportChartCard title="Vendas por categoria">
          {report.categorySeries.length === 0 ? emptyState : <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={report.categorySeries} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95}>{report.categorySeries.map((entry, index) => <Cell key={entry.name} fill={pieColors[index % pieColors.length]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>}
        </ReportChartCard>
        <ReportChartCard title="Métodos de pagamento">
          {report.paymentSeries.length === 0 ? emptyState : <ResponsiveContainer width="100%" height="100%"><BarChart data={report.paymentSeries}><XAxis dataKey="name" tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="value" fill="#ffb26b" radius={[10, 10, 0, 0]} /></BarChart></ResponsiveContainer>}
        </ReportChartCard>
      </div>
      <div className="mt-6"><ProductsPerformanceTable products={report.products} /></div>
    </AdminLayout>
  )
}
