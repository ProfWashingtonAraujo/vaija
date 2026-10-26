import type { Order } from '@/data/mock-orders'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { orderSourceIcons, orderSourceLabel, resolveOrderSource } from '@/lib/order-source'

type OrderCardProps = {
  order: Order
  active?: boolean
  /** Cartão fixo (não arrastável): usado em pedidos em rota, que só mudam pelo entregador. */
  locked?: boolean
  onClick: () => void
  onPointerDown?: (event: React.PointerEvent<HTMLElement>) => void
}

export function OrderCard({ order, active, locked, onClick, onPointerDown }: OrderCardProps) {
  return (
    <button
      onClick={onClick}
      onPointerDown={onPointerDown}
      onDragStart={(event) => event.preventDefault()}
      className={cn(
        'w-full rounded-2xl border bg-sa-surface p-4 text-left shadow-sa transition duration-200 hover:-translate-y-1 hover:border-sa-border-strong hover:shadow-sa',
        locked ? 'cursor-pointer' : 'cursor-grab select-none',
        active ? 'border-sa-border-strong ring-4 focus:ring-sa-accent/20' : 'border-sa-border',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold text-sa-text">#{order.id}</span>
        <StatusBadge status={order.status} />
      </div>
      <p className="mt-3 font-semibold text-sa-text">{order.customer}</p>
      <p className="mt-2 text-sm text-sa-muted">{order.items.join(' • ')}</p>
      <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-sa-accent-text">{(() => { const Icon = orderSourceIcons[resolveOrderSource(order.source)]; return <Icon className="h-3.5 w-3.5" /> })()}{orderSourceLabel(order.source, order.tableNumber)}</p>
      {order.payment === 'Pix' && order.source !== 'Mesa' ? <p className={cn('mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold', order.paid ? 'bg-sa-ok-soft text-sa-ok' : 'bg-sa-warn-soft text-sa-warn')}>{order.paid ? 'Pix pago' : 'Pix aguardando'}</p> : null}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-sa-muted">{order.elapsed}</span>
        <span className="font-mono font-semibold text-sa-text">{formatCurrency(order.value)}</span>
      </div>
    </button>
  )
}
