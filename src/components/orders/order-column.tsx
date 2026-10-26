import { motion } from 'framer-motion'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { Order } from '@/data/mock-orders'
import { OrderCard } from '@/components/orders/order-card'
import { EmptyState } from '@/components/shared/empty-state'
import type { BoardColumn, DragState } from '@/components/orders/use-order-drag'
import { cn } from '@/lib/utils'

type OrderColumnProps = {
  title: BoardColumn
  orders: Order[]
  selectedId?: number
  drag: DragState | null
  onSelect: (order: Order) => void
  onCardPointerDown: (order: Order, column: BoardColumn, event: ReactPointerEvent<HTMLElement>) => void
  shouldIgnoreClick: () => boolean
}

const slide = { type: 'spring', stiffness: 520, damping: 42 } as const

export function OrderColumn({ title, orders, selectedId, drag, onSelect, onCardPointerDown, shouldIgnoreClick }: OrderColumnProps) {
  const isOver = drag !== null && drag.col === title
  const visible = drag ? orders.filter((order) => order.id !== drag.order.id) : orders
  const slotBefore = isOver ? drag.beforeId : undefined

  const slot = <motion.div key="slot" layout="position" data-order-slot className="h-[var(--slot-h)] rounded-2xl border-[1.5px] border-dashed border-sa-accent/60 bg-sa-accent/10" style={{ '--slot-h': `${drag?.h ?? 0}px` } as React.CSSProperties} initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={slide} />

  return (
    <div
      data-board-col={title}
      className={cn(
        'relative rounded-3xl border bg-sa-surface p-4 shadow-sa transition-[border-color,background-color,box-shadow] duration-300',
        isOver ? 'border-sa-accent/50 bg-sa-accent-soft shadow-[0_0_32px_-8px_var(--sa-accent)]' : 'border-sa-border',
      )}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 font-heading text-lg font-bold text-sa-text">
          <span className={cn('h-2.5 w-2.5 rounded-full bg-sa-soft transition', isOver ? 'bg-sa-accent shadow-[0_0_10px_var(--sa-accent)]' : '')} />
          {title}
        </h3>
        <span className="rounded-full border border-sa-border bg-sa-surface px-3 py-1 text-xs font-semibold text-sa-accent-text shadow-sa">{visible.length}</span>
      </div>
      <div className="space-y-3">
        {visible.length === 0 && !isOver ? <EmptyState title="Fila vazia" description="Nenhum pedido nesta etapa da operação neste momento." /> : null}
        {visible.map((order) => (
          <motion.div key={order.id} layout="position" transition={slide} data-order-id={order.id}>
            {isOver && slotBefore === order.id ? <div className="mb-3">{slot}</div> : null}
            <OrderCard
              order={order}
              active={selectedId === order.id}
              onClick={() => {
                if (!shouldIgnoreClick()) onSelect(order)
              }}
              onPointerDown={(event) => onCardPointerDown(order, title, event)}
            />
          </motion.div>
        ))}
        {isOver && (slotBefore === null || !visible.some((order) => order.id === slotBefore)) ? slot : null}
      </div>
    </div>
  )
}
