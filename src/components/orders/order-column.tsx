import { Fragment } from 'react'
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
  const showPlaceholder = Boolean(isDropTarget) && draggedOrderId !== null
  const showEndPlaceholder = showPlaceholder && !orders.some((order) => order.id === dropTargetOrderId)

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
        'rounded-3xl border bg-sa-surface p-4 shadow-sa transition duration-200',
        isDropTarget ? 'border-sa-accent bg-sa-accent-soft shadow-[0_0_32px_-6px_var(--sa-accent)] ring-1 ring-sa-accent/40' : 'border-sa-border',
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-sa-text">
          <span className={cn('h-2.5 w-2.5 rounded-full bg-sa-soft transition', isDropTarget ? 'bg-sa-accent shadow-[0_0_10px_var(--sa-accent)]' : '')} />
          {title}
        </h3>
        <span className="rounded-full border border-sa-border bg-sa-surface px-3 py-1 text-xs font-semibold text-sa-accent-text shadow-sa">{orders.length}</span>
      </div>
      <div className="space-y-3">
        {orders.length === 0 && !showEndPlaceholder ? <EmptyState title="Fila vazia" description="Nenhum pedido nesta etapa da operação neste momento." /> : null}
        {orders.map((order) => (
          <Fragment key={order.id}>
          {showPlaceholder && dropTargetOrderId === order.id && draggedOrderId !== order.id ? <DropPlaceholder /> : null}
          <OrderCard
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
          </Fragment>
        ))}
        {showEndPlaceholder ? <DropPlaceholder /> : null}
      </div>
    </div>
  )
}

function DropPlaceholder() {
  return <div className="h-24 animate-pulse rounded-xl border border-dashed border-sa-accent bg-sa-accent/10" />
}
