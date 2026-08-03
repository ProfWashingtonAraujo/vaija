import type { Order } from '@/data/mock-orders'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency } from '@/lib/formatters'

export function OrderDetailsPanel({ order, onAdvance, onEdit, onOpenWhatsapp }: { order: Order; onAdvance: () => void; onEdit: () => void; onOpenWhatsapp: () => void }) {
  const source = order.source ?? 'Online'
  const deliveryFee = order.deliveryFee ?? (source === 'Online' ? 8 : 0)
  const subtotal = order.value - deliveryFee
  const nextStepLabel = order.status === 'Pendente' ? 'Avançar para Produção' : order.status === 'Em producao' ? 'Marcar como Pronto' : 'Finalizar Pedido'
  const canManageOrder = order.status === 'Pendente' || order.status === 'Em producao'

  return (
    <div className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-mono text-sm font-semibold text-slate-500">Pedido #{order.id}</p>
          <h3 className="mt-2 font-heading text-2xl font-bold text-slate-900">{order.customer}</h3>
        </div>
        <StatusBadge status={order.status} />
      </div>
      <div className="mt-6 space-y-4 text-sm text-slate-600">
        <p><span className="font-semibold text-slate-900">Telefone:</span> {order.phone}</p>
        <p><span className="font-semibold text-slate-900">Tipo:</span> {source}</p>
        {source === 'Mesa' ? (
          <p><span className="font-semibold text-slate-900">Mesa:</span> {order.tableNumber ?? 'Não informada'}</p>
        ) : (
          <p><span className="font-semibold text-slate-900">Endereço:</span> {order.address}</p>
        )}
        <div>
          <p className="font-semibold text-slate-900">Itens</p>
          <ul className="mt-2 space-y-2">
            {order.items.map((item) => <li key={item} className="rounded-2xl border border-orange-100 bg-white/90 px-3 py-2">{item}</li>)}
          </ul>
        </div>
        {order.notes ? (
          <div className="rounded-[24px] border border-amber-200 bg-amber-50/70 p-4 text-amber-800">
            <p className="font-semibold">Observação do cliente</p>
            <p className="mt-2 leading-6">{order.notes}</p>
          </div>
        ) : null}
        <div className="space-y-2 rounded-[24px] border border-orange-100 bg-white/80 p-4 shadow-[0_10px_24px_rgba(255,107,0,0.05)]">
          <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(subtotal)}</span></div>
          <div className="flex justify-between"><span>{source === 'Mesa' ? 'Taxa de mesa' : 'Taxa de entrega'}</span><span className="font-mono">{formatCurrency(deliveryFee)}</span></div>
          <div className="flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span className="font-mono">{formatCurrency(order.value)}</span></div>
          <div className="flex justify-between"><span>Pagamento</span><span>{order.payment}</span></div>
        </div>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {canManageOrder ? <Button variant="outline" className="border-orange-200 bg-white/90" onClick={onEdit}>Editar pedido</Button> : null}
        {canManageOrder ? <Button variant="secondary" onClick={onOpenWhatsapp}>Conversar no WhatsApp</Button> : null}
        <Button variant="outline" className="border-orange-200 bg-white/90">Imprimir Cupom</Button>
        <Button onClick={onAdvance}>{nextStepLabel}</Button>
      </div>
    </div>
  )
}
