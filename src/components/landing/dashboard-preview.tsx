import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts'
import { categorySeries, revenueSeries } from '@/data/mock-dashboard'
import { orders } from '@/data/mock-orders'
import { PageContainer } from '@/components/layout/page-container'
import { SectionHeader } from '@/components/shared/section-header'
import { formatCurrency } from '@/lib/formatters'
import { StatusBadge } from '@/components/shared/status-badge'
import { cn } from '@/lib/utils'

const tabs = ['Painel Geral', 'Pedidos', 'PDV'] as const

export function DashboardPreview() {
  const [tab, setTab] = useState<(typeof tabs)[number]>('Painel Geral')
  const previewOrders = useMemo(() => orders.slice(0, 3), [])

  return (
    <section id="dashboard" className="py-20">
      <PageContainer constrained>
        <SectionHeader
          badge="Veja a Vaija em operação"
          title="Um painel inteligente para acompanhar vendas, pedidos, caixa e desempenho do seu restaurante em tempo real."
          description="Abas demonstrativas permitem navegar pelo ecossistema da plataforma em poucos segundos."
        />
        <div className="mt-12 overflow-hidden rounded-[36px] border border-orange-200 bg-white/95 shadow-[0_30px_80px_rgba(255,107,0,0.08)] backdrop-blur-sm">
          <div className="grid lg:grid-cols-[260px_minmax(0,1fr)]">
            <aside className="border-b border-orange-100 bg-gradient-to-b from-[#fffaf5] to-white p-6 lg:border-b-0 lg:border-r">
              <p className="font-heading text-2xl font-bold text-slate-900">Vaija</p>
              <div className="mt-6 space-y-2">
                {['Painel Geral', 'Pedidos', 'PDV', 'Cardápio', 'Relatórios', 'Configurações'].map((item) => (
                  <div key={item} className={cn('rounded-2xl border px-4 py-3 text-sm font-semibold transition-all duration-200', item === tab ? 'border-orange-300 bg-white text-orange-700 shadow-[0_8px_18px_rgba(255,107,0,0.08)]' : 'border-transparent text-slate-500')}>
                    {item}
                  </div>
                ))}
              </div>
            </aside>
            <div className="p-6 lg:p-8">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <p className="font-heading text-2xl font-bold text-slate-900">{tab}</p>
                  <p className="mt-1 text-sm text-slate-500">Últimos 7 dias • Perfil Admin</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tabs.map((item) => (
                    <button key={item} type="button" aria-pressed={tab === item} onClick={() => setTab(item)} className={cn('rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-orange-200', tab === item ? 'border-orange-300 bg-orange-50 text-orange-700 shadow-[0_8px_18px_rgba(255,107,0,0.08)]' : 'border-orange-100 bg-white text-slate-600 hover:border-orange-200')}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div key={tab} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} className="mt-8">
                  {tab === 'Painel Geral' ? (
                    <div className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                        {[
                          ['Vendas hoje', 'R$ 2.840,00'],
                          ['Pedidos', '42'],
                          ['Ticket médio', 'R$ 67,60'],
                          ['Taxa de entrega', 'R$ 380,00'],
                        ].map(([label, value]) => (
                          <div key={label} className="rounded-[24px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                            <p className="text-sm text-slate-500">{label}</p>
                            <p className="mt-3 font-mono text-2xl font-bold text-slate-900">{value}</p>
                          </div>
                        ))}
                      </div>
                      <div className="grid gap-6 xl:grid-cols-2">
                        <div className="rounded-[28px] border border-orange-100 bg-white/80 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"><ResponsiveContainer width="100%" height={260}><BarChart data={revenueSeries}><XAxis dataKey="day" tickLine={false} axisLine={false} /><Tooltip formatter={(value: unknown) => formatCurrency(Number(value ?? 0))} /><Bar dataKey="revenue" fill="#ff6b00" radius={[10, 10, 0, 0]} /></BarChart></ResponsiveContainer></div>
                        <div className="rounded-[28px] border border-orange-100 bg-white/80 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]"><ResponsiveContainer width="100%" height={260}><PieChart><Pie data={categorySeries} dataKey="value" nameKey="name" innerRadius={60} outerRadius={92}>{categorySeries.map((entry, index) => <Cell key={entry.name} fill={['#ff6b00', '#ffb26b', '#ffd4ad', '#fed7aa'][index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer></div>
                      </div>
                    </div>
                  ) : null}
                  {tab === 'Pedidos' ? (
                    <div className="space-y-4">
                      {previewOrders.map((order) => (
                        <div key={order.id} className="flex flex-col gap-3 rounded-[24px] border border-orange-100 bg-white/80 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-mono text-sm font-semibold text-slate-900">#{order.id}</p>
                            <p className="mt-1 font-semibold text-slate-900">{order.customer}</p>
                            <p className="text-sm text-slate-500">{order.items.join(' • ')}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <StatusBadge status={order.status} />
                            <span className="font-mono font-semibold text-slate-900">{formatCurrency(order.value)}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {tab === 'PDV' ? (
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-[28px] border border-orange-100 bg-white/80 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <p className="font-heading text-xl font-bold text-slate-900">PDV ultrarrápido</p>
                        <div className="mt-4 grid gap-3">
                          {['Pepperoni Premium', 'Margherita D.O.P', 'Coca-Cola 600ml'].map((item) => <div key={item} className="rounded-2xl border border-orange-100 bg-orange-50/40 px-4 py-3 font-semibold text-slate-700">{item}</div>)}
                        </div>
                      </div>
                      <div className="rounded-[28px] border border-orange-100 bg-white/80 p-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                        <p className="font-heading text-xl font-bold text-slate-900">Carrinho atual</p>
                        <div className="mt-4 space-y-3 text-sm text-slate-600">
                          <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">R$ 73,40</span></div>
                          <div className="flex justify-between"><span>Taxa</span><span className="font-mono">R$ 8,00</span></div>
                          <div className="flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span className="font-mono">R$ 81,40</span></div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  )
}
