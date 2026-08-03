import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { reportKpis, dailyRevenue, orderStatusSeries, paymentSeries } from '@/data/mock-reports'
import { ReportKpiCard } from '@/components/reports/report-kpi-card'
import { ReportChartCard } from '@/components/reports/report-chart-card'
import { ProductsPerformanceTable } from '@/components/reports/products-performance-table'
import { Button } from '@/components/ui/button'
import { categorySeries } from '@/data/mock-dashboard'
import { formatCurrency } from '@/lib/formatters'

export function ReportsPage() {
  return (
    <AdminLayout title="Relatórios Inteligentes" description="Visualize indicadores, filtros e exportações demonstrativas para decisão mais rápida.">
      <div className="rounded-[30px] border border-orange-100 bg-gradient-to-r from-[#fffaf5] to-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Insights</p>
            <p className="mt-1 font-heading text-2xl font-bold text-slate-900">Exportações e leitura rápida dos indicadores</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" className="border-orange-200 bg-white/90" onClick={() => toast.success('Exportação PDF iniciada.')}>Exportar PDF</Button>
            <Button variant="outline" className="border-orange-200 bg-white/90" onClick={() => toast.success('Exportação CSV iniciada.')}>Exportar CSV</Button>
          </div>
        </div>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {reportKpis.map((kpi) => <ReportKpiCard key={kpi.label} label={kpi.label} value={kpi.value} />)}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <ReportChartCard title="Receita por dia">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={dailyRevenue}><XAxis dataKey="day" tickLine={false} axisLine={false} /><Tooltip formatter={(value: unknown) => formatCurrency(Number(value ?? 0))} /><Bar dataKey="value" fill="#ff6b00" radius={[10, 10, 0, 0]} /></BarChart></ResponsiveContainer>
        </ReportChartCard>
        <ReportChartCard title="Pedidos por status">
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={orderStatusSeries} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95}>{orderStatusSeries.map((entry, index) => <Cell key={entry.name} fill={['#ff6b00', '#ffb26b', '#fed7aa', '#fdba74'][index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
        </ReportChartCard>
        <ReportChartCard title="Vendas por categoria">
          <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={categorySeries} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95}>{categorySeries.map((entry, index) => <Cell key={entry.name} fill={['#ff6b00', '#ffb26b', '#ffd4ad', '#fed7aa'][index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
        </ReportChartCard>
        <ReportChartCard title="Métodos de pagamento">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={paymentSeries}><XAxis dataKey="name" tickLine={false} axisLine={false} /><Tooltip /><Bar dataKey="value" fill="#ffb26b" radius={[10, 10, 0, 0]} /></BarChart></ResponsiveContainer>
        </ReportChartCard>
      </div>
      <div className="mt-6"><ProductsPerformanceTable /></div>
    </AdminLayout>
  )
}
