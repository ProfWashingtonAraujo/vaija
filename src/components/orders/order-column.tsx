import type { Order } from '@/data/mock-orders'
import { OrderCard } from '@/components/orders/order-card'
import { EmptyState } from '@/components/shared/empty-state'

export function OrderColumn({ title, orders, selectedId, onSelect }: { title: string; orders: Order[]; selectedId?: number; onSelect: (order: Order) => void }) {
  return (
    <div className="rounded-[30px] border border-orange-100 bg-gradient-to-b from-[#fffaf5] to-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.05)]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-lg font-bold text-slate-900">{title}</h3>
        <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700 shadow-[0_8px_18px_rgba(255,107,0,0.08)]">{orders.length}</span>
      </div>
      <div className="space-y-3">
        {orders.length === 0 ? <EmptyState title="Fila vazia" description="Nenhum pedido nesta etapa da operação neste momento." /> : null}
        {orders.map((order) => <OrderCard key={order.id} order={order} active={selectedId === order.id} onClick={() => onSelect(order)} />)}
      </div>
    </div>
  )
}
