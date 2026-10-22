import type { Order } from '@/data/mock-orders'
import { formatCurrency } from '@/lib/formatters'
import { StatusBadge } from '@/components/shared/status-badge'
import { Link } from 'react-router-dom'
import { EmptyState } from '@/components/shared/empty-state'

/** Hoje: só a hora. Outro dia: data e hora. Sem data de criação, usa o texto salvo no pedido. */
function formatOrderTime(order: Order) {
  if (!order.createdAt) return order.time
  const created = new Date(order.createdAt)
  const time = created.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return created.toDateString() === new Date().toDateString() ? time : `${created.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} ${time}`
}

export function LatestOrdersTable({ orders }: { orders: Order[] }) {
  return (
    <section className="rounded-2xl border border-sa-border bg-sa-surface p-5 shadow-sa sm:p-6">
      <div className="mb-5 flex items-center justify-between gap-3">
        <h3 className="font-heading text-lg font-bold text-sa-text">Últimos pedidos</h3>
        <Link to="/orders" className="rounded-xl border border-sa-border px-3 py-2 text-xs font-semibold text-sa-muted transition-colors hover:bg-sa-hover hover:text-sa-text">Ver todos</Link>
      </div>
      {orders.length === 0 ? (
        <EmptyState title="Nenhum pedido recente" description="Assim que os pedidos chegarem, eles aparecerão aqui para consulta rápida." />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-sa-border lg:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-sa-surface-2 text-[11px] font-bold uppercase tracking-[0.12em] text-sa-soft">
                <tr>
                  <th className="px-4 py-2.5">ID Pedido</th><th className="px-4 py-2.5">Cliente</th><th className="px-4 py-2.5">Horário</th><th className="px-4 py-2.5">Valor</th><th className="px-4 py-2.5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-sa-border text-sa-text-2">
                {orders.map((order) => (
                  <tr key={order.id} className="transition-colors hover:bg-sa-hover">
                    <td className="px-4 py-3.5 font-mono font-semibold text-sa-text">#{order.id}</td>
                    <td className="px-4 py-3.5 font-semibold text-sa-text">{order.customer}</td>
                    <td className="px-4 py-3.5">{formatOrderTime(order)}</td>
                    <td className="px-4 py-3.5 font-mono font-bold text-sa-text">{formatCurrency(order.value)}</td>
                    <td className="px-4 py-3.5"><StatusBadge status={order.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-3 lg:hidden">
            {orders.map((order) => (
              <div key={order.id} className="rounded-xl border border-sa-border bg-sa-surface-2 p-4">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-semibold text-sa-text">#{order.id}</span>
                  <StatusBadge status={order.status} />
                </div>
                <p className="mt-3 font-semibold text-sa-text">{order.customer}</p>
                <p className="mt-1 text-sm text-sa-muted">{formatOrderTime(order)} • {formatCurrency(order.value)}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  )
}
