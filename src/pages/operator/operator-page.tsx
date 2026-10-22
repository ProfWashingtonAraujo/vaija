import { useEffect, useMemo, useState } from 'react'
import { Clock, CreditCard, ListChecks, ShoppingBag } from 'lucide-react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { fetchOrders } from '@/lib/orders-api'
import { usePolling } from '@/lib/use-polling'
import { formatCurrency } from '@/lib/formatters'
import type { Order } from '@/data/mock-orders'
import { cn } from '@/lib/utils'

const actionLinkClass = 'inline-flex items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-sa-accent/20'

export function OperatorPage() {
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    void fetchOrders()
      .then(setOrders)
      .catch(() => {
        toast.error('Não foi possível carregar os pedidos da operação.')
      })
  }, [])

  usePolling(() => fetchOrders().then(setOrders).catch(() => undefined))

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
          <div key={label} className="rounded-2xl border border-sa-border bg-sa-surface p-5 shadow-sa">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-sa-muted">{label}</p>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sa-accent-soft text-sa-accent-text">
                <Icon className="h-5 w-5" />
              </div>
            </div>
            <p className="mt-4 font-heading text-3xl font-bold text-sa-text">{value}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="rounded-2xl border border-sa-border bg-sa-surface p-5 shadow-sa">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sa-soft">Fila do turno</p>
              <h2 className="mt-1 font-heading text-2xl font-bold text-sa-text">Próximos pedidos</h2>
            </div>
            <Link to="/orders" className={cn(actionLinkClass, 'border-sa-border bg-sa-surface text-sa-text hover:border-sa-border-strong hover:text-sa-accent-text')}>Ver todos</Link>
          </div>
          <div className="mt-5 space-y-3">
            {nextOrders.map((order) => (
              <Link key={order.id} to="/orders" className="block rounded-2xl border border-sa-border bg-sa-surface p-4 transition hover:border-sa-border-strong hover:bg-sa-hover">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sa-text">#{order.id} · {order.customer}</p>
                    <p className="mt-1 text-sm text-sa-muted">{order.items.join(', ')}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-mono text-sm font-semibold text-sa-text">{formatCurrency(order.value)}</p>
                    <p className="mt-1 text-xs font-semibold text-sa-accent-text">{order.status}</p>
                  </div>
                </div>
              </Link>
            ))}
            {nextOrders.length === 0 ? <p className="rounded-2xl border border-dashed border-sa-border bg-sa-surface-2 p-6 text-center text-sm font-semibold text-sa-muted">Nenhum pedido ativo no momento.</p> : null}
          </div>
        </section>

        <aside className="space-y-4 rounded-2xl border border-sa-border bg-sa-surface p-5 shadow-sa">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sa-soft">Ações rápidas</p>
            <h2 className="mt-1 font-heading text-2xl font-bold text-sa-text">Operação</h2>
          </div>
          <Link to="/pos" className={cn(actionLinkClass, 'w-full border-sa-accent bg-sa-accent text-white shadow-sa hover:-translate-y-0.5 hover:opacity-90')}>Abrir PDV</Link>
          <Link to="/orders" className={cn(actionLinkClass, 'w-full border-sa-border bg-sa-surface text-sa-text hover:border-sa-border-strong hover:text-sa-accent-text')}>Gerenciar pedidos</Link>
          <div className="rounded-2xl border border-sa-border bg-sa-surface-2 p-4">
            <p className="text-sm font-semibold text-sa-text">Resumo da fila</p>
            <div className="mt-3 space-y-2 text-sm text-sa-text-2">
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
