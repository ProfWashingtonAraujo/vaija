import type { Order } from '@/data/mock-orders'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { orderSourceIcons, orderSourceLabel, resolveOrderSource } from '@/lib/order-source'

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
      <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-orange-700">{(() => { const Icon = orderSourceIcons[resolveOrderSource(order.source)]; return <Icon className="h-3.5 w-3.5" /> })()}{orderSourceLabel(order.source, order.tableNumber)}</p>
      {order.payment === 'Pix' && order.source !== 'Mesa' ? <p className={cn('mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-semibold', order.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{order.paid ? 'Pix pago' : 'Pix aguardando'}</p> : null}
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-500">{order.elapsed}</span>
        <span className="font-mono font-semibold text-slate-900">{formatCurrency(order.value)}</span>
      </div>
    </button>
  )
}
