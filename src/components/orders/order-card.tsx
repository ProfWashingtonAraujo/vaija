import type { Order } from '@/data/mock-orders'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export function OrderCard({ order, active, onClick }: { order: Order; active?: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn('w-full rounded-[24px] border bg-white/95 p-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.05)] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_18px_36px_rgba(255,107,0,0.1)]', active ? 'border-orange-300 ring-4 ring-orange-100' : 'border-orange-100')}>
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold text-slate-900">#{order.id}</span>
        <StatusBadge status={order.status} />
      </div>
      <p className="mt-3 font-semibold text-slate-900">{order.customer}</p>
      <p className="mt-2 text-sm text-slate-500">{order.items.join(' • ')}</p>
      <div className="mt-4 flex items-center justify-between text-sm">
        <span className="text-slate-500">{order.elapsed}</span>
        <span className="font-mono font-semibold text-slate-900">{formatCurrency(order.value)}</span>
      </div>
    </button>
  )
}
