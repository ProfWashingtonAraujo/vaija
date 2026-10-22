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
        'rounded-2xl border bg-sa-surface p-4 shadow-sa transition',
        isDropTarget ? 'border-sa-border-strong shadow-sa ring-4 focus:ring-sa-accent/20' : 'border-sa-border',
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-heading text-lg font-bold text-sa-text">{title}</h3>
        <span className="rounded-full border border-sa-border bg-sa-surface px-3 py-1 text-xs font-semibold text-sa-accent-text shadow-sa">{orders.length}</span>
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
