import type { Order } from '@/data/mock-orders'
import { OrderCard } from '@/components/orders/order-card'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

type OrderColumnProps = {
  title: 'Pendente' | 'Em Produção' | 'Pronto/Retirada'
  orders: Order[]
  selectedId?: number
  draggedOrderId: number | null
  isDropTarget?: boolean
  dropTargetOrderId: number | null
  onSelect: (order: Order) => void
  onDragStart: (orderId: number) => void
  onDragEnd: () => void
  onDragEnter: () => void
  onDragLeave: () => void
  onDragOverOrder: (orderId: number | null) => void
  onDropOrder: (orderId: number, column: 'Pendente' | 'Em Produção' | 'Pronto/Retirada', targetOrderId?: number) => void
}

export function OrderColumn({ title, orders, selectedId, draggedOrderId, isDropTarget, dropTargetOrderId, onSelect, onDragStart, onDragEnd, onDragEnter, onDragLeave, onDragOverOrder, onDropOrder }: OrderColumnProps) {
  return (
    <div
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDragLeave={(event) => {
        const nextTarget = event.relatedTarget

        if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
          return
        }

        onDragOverOrder(null)
        onDragLeave()
      }}
      onDrop={(event) => {
        event.preventDefault()
        onDragOverOrder(null)

        const orderId = Number(event.dataTransfer.getData('text/plain'))
        if (!Number.isNaN(orderId)) {
          onDropOrder(orderId, title)
        }
      }}
      className={cn(
        'rounded-[30px] border bg-gradient-to-b from-[#fffaf5] to-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.05)] transition',
        isDropTarget ? 'border-orange-300 shadow-[0_18px_36px_rgba(255,107,0,0.12)] ring-4 ring-orange-100' : 'border-orange-100',
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-lg font-bold text-slate-900">{title}</h3>
        <span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700 shadow-[0_8px_18px_rgba(255,107,0,0.08)]">{orders.length}</span>
      </div>
      <div className="space-y-3">
        {orders.length === 0 ? <EmptyState title="Fila vazia" description="Nenhum pedido nesta etapa da operação neste momento." /> : null}
        {orders.map((order) => (
          <OrderCard
            key={order.id}
            order={order}
            active={selectedId === order.id}
            dragging={draggedOrderId === order.id}
            dropTarget={dropTargetOrderId === order.id}
            onClick={() => onSelect(order)}
            onDragStart={() => onDragStart(order.id)}
            onDragEnd={onDragEnd}
            onDragEnter={() => {
              onDragEnter()
              onDragOverOrder(order.id)
            }}
            onDrop={() => onDropOrder(draggedOrderId ?? order.id, title, order.id)}
          />
        ))}
      </div>
    </div>
  )
}
