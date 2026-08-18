import { Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PaymentMethodSelector } from '@/components/pos/payment-method-selector'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'

type CartItem = { id: string; name: string; price: number; quantity: number }
type OrderSource = 'Mesa' | 'Online'

export function CartPanel({ items, paymentMethod, orderSource, tableNumber, customerName, customerPhone, notes, onPaymentChange, onOrderSourceChange, onTableNumberChange, onCustomerNameChange, onCustomerPhoneChange, onNotesChange, onUpdateQuantity, onRemove, onClear, onCheckout }: { items: CartItem[]; paymentMethod: string; orderSource: OrderSource; tableNumber: string; customerName: string; customerPhone: string; notes: string; onPaymentChange: (value: 'Pix' | 'Cartão' | 'Dinheiro') => void; onOrderSourceChange: (value: OrderSource) => void; onTableNumberChange: (value: string) => void; onCustomerNameChange: (value: string) => void; onCustomerPhoneChange: (value: string) => void; onNotesChange: (value: string) => void; onUpdateQuantity: (id: string, amount: number) => void; onRemove: (id: string) => void; onClear: () => void; onCheckout: () => void }) {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const delivery = items.length && orderSource === 'Online' ? 8 : 0
  const total = subtotal + delivery

  return (
    <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-xl font-bold text-slate-900">Carrinho</h3>
        {items.length > 0 ? (
          <ConfirmDialog
            trigger={<button className="text-sm font-semibold text-orange-700">Limpar</button>}
            title="Limpar carrinho?"
            description="Todos os itens adicionados serão removidos deste pedido em andamento."
            confirmLabel="Limpar carrinho"
            onConfirm={onClear}
          />
        ) : (
          <span className="text-sm font-semibold text-slate-300">Limpar</span>
        )}
      </div>
      <div className="mt-5 space-y-3">
        {items.length === 0 ? <EmptyState title="Carrinho vazio" description="Adicione produtos para montar o pedido e seguir para o fechamento." icon={<Trash2 className="h-5 w-5" />} /> : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-[24px] border border-orange-100 bg-white/90 p-4 shadow-[0_10px_24px_rgba(255,107,0,0.05)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">{item.name}</p>
                <p className="mt-1 font-mono text-sm text-slate-500">{formatCurrency(item.price)} un. · {formatCurrency(item.price * item.quantity)}</p>
              </div>
              <button onClick={() => onRemove(item.id)} className="rounded-full p-2 text-slate-400 hover:bg-orange-50 hover:text-orange-600"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="outline" className="h-9 w-9 px-0" onClick={() => onUpdateQuantity(item.id, -1)}>-</Button>
              <span className="min-w-8 text-center font-mono font-semibold">{item.quantity}</span>
              <Button variant="outline" className="h-9 w-9 px-0" onClick={() => onUpdateQuantity(item.id, 1)}>+</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3 rounded-[24px] border border-orange-100 bg-white/80 p-4 text-sm text-slate-600 shadow-[0_10px_24px_rgba(255,107,0,0.05)]">
        <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(subtotal)}</span></div>
        <div className="flex justify-between"><span>Taxa de entrega</span><span className="font-mono">{formatCurrency(delivery)}</span></div>
        <div className="flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span className="font-mono">{formatCurrency(total)}</span></div>
      </div>
      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-slate-900">Tipo do pedido</p>
        <div className="grid grid-cols-2 gap-2 rounded-[24px] border border-orange-100 bg-white/80 p-2">
          {(['Mesa', 'Online'] as const).map((source) => (
            <button key={source} onClick={() => onOrderSourceChange(source)} className={cn('rounded-2xl border px-3 py-2 text-sm font-semibold transition-all duration-200', orderSource === source ? 'border-orange-300 bg-orange-50 text-orange-700 shadow-[0_8px_18px_rgba(255,107,0,0.08)]' : 'border-orange-100 bg-white text-slate-600 hover:border-orange-200')}>
              {source}
            </button>
          ))}
        </div>
        {orderSource === 'Mesa' ? (
          <div className="mt-3 space-y-3">
            <Input value={tableNumber} onChange={(event) => onTableNumberChange(event.target.value)} placeholder="Número da mesa" />
            <div className="grid grid-cols-4 gap-2">
              {['1', '2', '3', '4'].map((number) => <button key={number} type="button" onClick={() => onTableNumberChange(number)} className="rounded-2xl border border-orange-100 bg-white px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-orange-300 hover:bg-orange-50">Mesa {number}</button>)}
            </div>
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            <Input value={customerName} onChange={(event) => onCustomerNameChange(event.target.value)} placeholder="Nome do cliente" />
            <Input value={customerPhone} onChange={(event) => onCustomerPhoneChange(event.target.value)} placeholder="Telefone do cliente" inputMode="tel" />
          </div>
        )}
      </div>
      <label className="mt-6 grid gap-2 text-sm font-semibold text-slate-900">
        Observação do pedido
        <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Ex: sem cebola, troco para R$ 100, entregar no balcão" className="min-h-20 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100" />
      </label>
      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-slate-900">Método de pagamento</p>
        <PaymentMethodSelector value={paymentMethod} onChange={onPaymentChange} />
      </div>
      <Button className="mt-6 w-full shadow-[0_14px_30px_rgba(255,107,0,0.22)]" onClick={onCheckout}>Finalizar Pedido</Button>
    </div>
  )
}
