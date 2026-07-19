import type { Order } from '@/data/mock-orders'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency } from '@/lib/formatters'

export function OrderDetailsPanel({ order, onAdvance }: { order: Order; onAdvance: () => void }) {
  const subtotal = order.value - 8

  return (
    <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-slate-500">Pedido #{order.id}</p>
          <h3 className="mt-2 font-heading text-2xl font-bold text-slate-900">{order.customer}</h3>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-6 space-y-4 text-sm text-slate-600">
        <p><span className="font-semibold text-slate-900">Telefone:</span> {order.phone}</p>
        <p><span className="font-semibold text-slate-900">Endereco:</span> {order.address}</p>
        <div>
          <p className="font-semibold text-slate-900">Itens</p>
          <ul className="mt-2 space-y-2">
            {order.items.map((item) => <li key={item} className="rounded-2xl border border-orange-100 bg-white/90 px-3 py-2">{item}</li>)}
          </ul>
        </div>
        <div className="space-y-2 rounded-[24px] border border-orange-100 bg-white/80 p-4 shadow-[0_10px_24px_rgba(255,107,0,0.05)]">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between"><span>Taxa</span><span className="font-mono">{formatCurrency(8)}</span></div>
          <div className="flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span className="font-mono">{formatCurrency(order.value)}</span></div>
          <div className="flex justify-between"><span>Pagamento</span><span>{order.payment}</span></div>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <Button variant="outline" className="border-orange-200 bg-white/90">Imprimir Cupom</Button>
        <Button onClick={onAdvance}>Avançar para Produção</Button>
      </div>
    </div>
  )
}
