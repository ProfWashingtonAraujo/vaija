import { useEffect, useMemo, useState } from 'react'
import { Clock, CreditCard, ListChecks, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { fetchOrders } from '@/lib/orders-api'
import { formatCurrency } from '@/lib/formatters'
import { orders as mockOrders, type Order } from '@/data/mock-orders'
import { cn } from '@/lib/utils'

const actionLinkClass = 'inline-flex items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-orange-200'

export function OperatorPage() {
  const [orders, setOrders] = useState<Order[]>(mockOrders)

  useEffect(() => {
    void fetchOrders()
      .then((loadedOrders) => {
        if (loadedOrders.length > 0) {
          setOrders(loadedOrders)
        }
      })
      .catch(() => {
        toast.error('Não foi possível carregar os pedidos da operação.')
      })
  }, [])

  const activeOrders = useMemo(() => orders.filter((order) => order.status !== 'Entregue'), [orders])
  const pendingOrders = activeOrders.filter((order) => order.status === 'Pendente')
  const productionOrders = activeOrders.filter((order) => order.status === 'Em producao')
  const readyOrders = activeOrders.filter((order) => order.status === 'Pronto para retirada')
  const activeTotal = activeOrders.reduce((sum, order) => sum + order.value, 0)
  const nextOrders = activeOrders.slice(0, 5)

  return (
    <AdminLayout title="Área do Operador" description="Atalhos e fila do turno para atendimento, caixa e produção.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Pedidos ativos', value: activeOrders.length, icon: ShoppingBag },
          { label: 'Pendentes', value: pendingOrders.length, icon: Clock },
          { label: 'Em produção', value: productionOrders.length, icon: ListChecks },
          { label: 'Valor em fila', value: formatCurrency(activeTotal), icon: CreditCard },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600">
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 font-heading text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Fila do turno</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-slate-900">Próximos pedidos</h2>
            </div>
            <Link to="/orders" className={cn(actionLinkClass, 'border-orange-200 bg-white text-slate-800 hover:border-orange-400 hover:text-orange-700')}>Ver todos</Link>
          </div>
          <div className="mt-5 space-y-3">
            {nextOrders.map((order) => (
              <Link key={order.id} to="/orders" className="block rounded-2xl border border-orange-100 bg-white p-4 transition hover:border-orange-300 hover:bg-orange-50/40">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">#{order.id} · {order.customer}</p>
                    <p className="mt-1 text-sm text-slate-500">{order.items.join(', ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-slate-900">{formatCurrency(order.value)}</p>
                    <p className="mt-1 text-xs font-semibold text-orange-700">{order.status}</p>
                  </div>
                </div>
              </Link>
            ))}
            {nextOrders.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center text-sm font-semibold text-slate-500">Nenhum pedido ativo no momento.</p> : null}
          </div>
        </section>

        <aside className="space-y-4 rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ações rápidas</p>
            <h2 className="mt-1 font-heading text-2xl font-bold text-slate-900">Operação</h2>
          </div>
          <Link to="/waiter" className={cn(actionLinkClass, 'w-full border-orange-500 bg-orange-500 text-white shadow-[0_10px_30px_rgba(255,107,0,0.24)] hover:-translate-y-0.5 hover:bg-orange-600')}>Novo atendimento</Link>
          <Link to="/orders" className={cn(actionLinkClass, 'w-full border-orange-200 bg-white text-slate-800 hover:border-orange-400 hover:text-orange-700')}>Gerenciar pedidos</Link>
          <div className="rounded-2xl border border-orange-100 bg-orange-50/50 p-4">
            <p className="text-sm font-semibold text-slate-900">Resumo da fila</p>
            <div className="mt-3 space-y-2 text-sm text-slate-600">
              <div className="flex justify-between"><span>Pendentes</span><span className="font-mono font-semibold">{pendingOrders.length}</span></div>
              <div className="flex justify-between"><span>Em produção</span><span className="font-mono font-semibold">{productionOrders.length}</span></div>
              <div className="flex justify-between"><span>Prontos</span><span className="font-mono font-semibold">{readyOrders.length}</span></div>
            </div>
          </div>
        </aside>
      </div>
    </AdminLayout>
  )
}
