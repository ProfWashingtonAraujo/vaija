import type { Order } from '@/data/mock-orders'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type OrderCardProps = {
  order: Order
  active?: boolean
  dragging?: boolean
  dropTarget?: boolean
  /** Cartão fixo (não arrastável): usado em pedidos em rota, que só mudam pelo entregador. */
  locked?: boolean
  onClick: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragEnter: () => void
  onDrop: () => void
}

export function OrderCard({ order, active, dragging, dropTarget, locked, onClick, onDragStart, onDragEnd, onDragEnter, onDrop }: OrderCardProps) {
  return (
    <button
      draggable={!locked}
      onClick={onClick}
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', String(order.id))
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDrop()
      }}
      className={cn(
        'w-full rounded-[24px] border bg-white/95 p-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_18px_36px_rgba(255,107,0,0.1)]',
        locked ? 'cursor-pointer' : 'cursor-grab active:cursor-grabbing',
        active ? 'border-orange-300 ring-4 ring-orange-100' : 'border-orange-100',
        dragging ? 'scale-[0.98] opacity-70' : '',
        dropTarget ? 'border-orange-300 shadow-[0_18px_36px_rgba(255,107,0,0.12)]' : '',
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold text-slate-900">#{order.id}</span>
        <StatusBadge status={order.status} />
      </div>
      <p className="mt-3 font-semibold text-slate-900">{order.customer}</p>
      <p className="mt-2 text-sm text-slate-500">{order.items.join(' • ')}</p>
      <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">{order.source === 'Mesa' ? `Mesa ${order.tableNumber ?? '--'}` : 'Online'}</p>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-500">{order.elapsed}</span>
        <span className="font-mono font-semibold text-slate-900">{formatCurrency(order.value)}</span>
      </div>
    </button>
  )
}
