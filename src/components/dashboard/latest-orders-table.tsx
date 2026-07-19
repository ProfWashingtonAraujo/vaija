import type { Order } from '@/data/mock-orders'
import { formatCurrency } from '@/lib/formatters'
import { StatusBadge } from '@/components/shared/status-badge'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'

export function LatestOrdersTable({ orders }: { orders: Order[] }) {
  return (
    <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-xl font-bold text-slate-900">Últimos pedidos</h3>
        <Button variant="outline" className="border-orange-200 bg-white/90 shadow-none">Ver todos</Button>
      </div>
      {orders.length === 0 ? (
        <EmptyState title="Nenhum pedido recente" description="Assim que os pedidos chegarem, eles aparecerão aqui para consulta rápida." />
      ) : null}
      <div className="hidden overflow-x-auto rounded-[24px] border border-orange-100 bg-white/80 px-4 lg:block">
        <table className="w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr>
              <th className="pb-3">ID Pedido</th><th className="pb-3">Cliente</th><th className="pb-3">Horário</th><th className="pb-3">Valor</th><th className="pb-3">Status</th><th className="pb-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-t border-orange-50">
                <td className="py-4 font-mono">#{order.id}</td>
                <td className="py-4">{order.customer}</td>
                <td className="py-4">{order.time}</td>
                <td className="py-4 font-mono">{formatCurrency(order.value)}</td>
                <td className="py-4"><StatusBadge status={order.status} /></td>
                <td className="py-4"><Button variant="ghost">Detalhes</Button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-3 lg:hidden">
        {orders.map((order) => (
          <div key={order.id} className="rounded-3xl border border-orange-100 bg-white/90 p-4 shadow-[0_10px_24px_rgba(255,107,0,0.05)]">
            <div className="flex items-center justify-between">
              <span className="font-mono text-sm font-semibold text-slate-900">#{order.id}</span>
              <StatusBadge status={order.status} />
            </div>
            <p className="mt-3 font-semibold text-slate-900">{order.customer}</p>
            <p className="mt-1 text-sm text-slate-500">{order.time} • {formatCurrency(order.value)}</p>
          </div>
        ))}
      </div>
    </div>
  )
}
