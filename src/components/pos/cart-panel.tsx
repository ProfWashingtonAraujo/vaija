import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/formatters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PaymentMethodSelector } from '@/components/pos/payment-method-selector'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { EmptyState } from '@/components/shared/empty-state'
import { cn } from '@/lib/utils'
import { readSettings, settingsUpdatedEvent, tableLabel } from '@/lib/settings'
import { orderSources, orderSourceIcons, type OrderSource } from '@/lib/order-source'

type CartItem = { id: string; name: string; price: number; quantity: number }

export function CartPanel({ items, paymentMethod, orderSource, tableNumber, customerName, customerPhone, notes, onPaymentChange, onOrderSourceChange, onTableNumberChange, onCustomerNameChange, onCustomerPhoneChange, onNotesChange, onUpdateQuantity, onRemove, onClear, onCheckout }: { items: CartItem[]; paymentMethod: string; orderSource: OrderSource; tableNumber: string; customerName: string; customerPhone: string; notes: string; onPaymentChange: (value: 'Pix' | 'Cartão' | 'Dinheiro') => void; onOrderSourceChange: (value: OrderSource) => void; onTableNumberChange: (value: string) => void; onCustomerNameChange: (value: string) => void; onCustomerPhoneChange: (value: string) => void; onNotesChange: (value: string) => void; onUpdateQuantity: (id: string, amount: number) => void; onRemove: (id: string) => void; onClear: () => void; onCheckout: () => void }) {
  const [tables, setTables] = useState(() => readSettings().tables)
  useEffect(() => {
    const update = () => setTables(readSettings().tables)
    window.addEventListener(settingsUpdatedEvent, update)
    return () => window.removeEventListener(settingsUpdatedEvent, update)
  }, [])
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const delivery = items.length && orderSource === 'Online' ? 8 : 0
  const total = subtotal + delivery

  return (
    <div className="rounded-2xl border border-sa-border bg-sa-surface p-5 shadow-sa">
      <div className="flex items-center justify-between">
        <h3 className="font-heading text-xl font-bold text-sa-text">Carrinho</h3>
        {items.length > 0 ? (
          <ConfirmDialog
            trigger={<button className="text-sm font-semibold text-sa-accent-text">Limpar</button>}
            title="Limpar carrinho?"
            description="Todos os itens adicionados serão removidos deste pedido em andamento."
            confirmLabel="Limpar carrinho"
            onConfirm={onClear}
          />
        ) : (
          <span className="text-sm font-semibold text-sa-soft">Limpar</span>
        )}
      </div>
      <div className="mt-5 space-y-3">
        {items.length === 0 ? <EmptyState title="Carrinho vazio" description="Adicione produtos para montar o pedido e seguir para o fechamento." icon={<Trash2 className="h-5 w-5" />} /> : null}
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-sa-border bg-sa-surface p-4 shadow-sa">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-sa-text">{item.name}</p>
                <p className="mt-1 font-mono text-sm text-sa-muted">{formatCurrency(item.price)} un. · {formatCurrency(item.price * item.quantity)}</p>
              </div>
              <button onClick={() => onRemove(item.id)} className="rounded-full p-2 text-sa-soft hover:bg-sa-hover hover:text-sa-accent-text"><Trash2 className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 flex items-center gap-2">
              <Button variant="outline" className="h-9 w-9 px-0" onClick={() => onUpdateQuantity(item.id, -1)}>-</Button>
              <span className="min-w-8 text-center font-mono font-semibold">{item.quantity}</span>
              <Button variant="outline" className="h-9 w-9 px-0" onClick={() => onUpdateQuantity(item.id, 1)}>+</Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3 rounded-xl border border-sa-border bg-sa-surface p-4 text-sm text-sa-text-2 shadow-sa">
        <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(subtotal)}</span></div>
        <div className="flex justify-between"><span>Taxa de entrega</span><span className="font-mono">{formatCurrency(delivery)}</span></div>
        <div className="flex justify-between text-base font-semibold text-sa-text"><span>Total</span><span className="font-mono">{formatCurrency(total)}</span></div>
      </div>
      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-sa-text">Tipo do pedido</p>
        <div className="grid grid-cols-3 gap-2 rounded-xl border border-sa-border bg-sa-surface p-2">
          {orderSources.map((source) => {
            const Icon = orderSourceIcons[source]
            return (
            <button key={source} onClick={() => onOrderSourceChange(source)} className={cn('flex flex-col items-center gap-1 rounded-2xl border px-2 py-2.5 text-sm font-semibold transition-all duration-200', orderSource === source ? 'border-sa-border-strong bg-sa-accent-soft text-sa-accent-text shadow-sa' : 'border-sa-border bg-sa-surface text-sa-text-2 hover:border-sa-border-strong')}>
              <Icon className="h-5 w-5" />
              {source}
            </button>
            )
          })}
        </div>
        {orderSource === 'Mesa' ? (
          <div className="mt-3 space-y-3">
            <Input value={tableNumber} onChange={(event) => onTableNumberChange(event.target.value)} placeholder="Número da mesa" />
            {tables.length > 0 ? (
              <div className="grid grid-cols-4 gap-2">
                {tables.map((name) => <button key={name} type="button" onClick={() => onTableNumberChange(name)} className={cn('rounded-2xl border px-2 py-2 text-sm font-semibold transition hover:border-sa-border-strong hover:bg-sa-hover', tableNumber === name ? 'border-sa-border-strong bg-sa-accent-soft text-sa-accent-text' : 'border-sa-border bg-sa-surface text-sa-text-2')}>{tableLabel(name)}</button>)}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            <Input value={customerName} onChange={(event) => onCustomerNameChange(event.target.value)} placeholder="Nome do cliente" />
            <Input value={customerPhone} onChange={(event) => onCustomerPhoneChange(event.target.value)} placeholder="Telefone do cliente" inputMode="tel" />
          </div>
        )}
      </div>
      <label className="mt-6 grid gap-2 text-sm font-semibold text-sa-text">
        Observação do pedido
        <textarea value={notes} onChange={(event) => onNotesChange(event.target.value)} placeholder="Ex: sem cebola, troco para R$ 100, entregar no balcão" className="min-h-20 rounded-2xl border border-sa-border bg-sa-surface px-4 py-3 text-sm text-sa-text outline-none transition-all duration-200 placeholder:text-sa-soft focus:border-sa-accent focus:ring-4 focus:ring-sa-accent/20" />
      </label>
      <div className="mt-6">
        <p className="mb-3 text-sm font-semibold text-sa-text">Método de pagamento</p>
        <PaymentMethodSelector value={paymentMethod} onChange={onPaymentChange} />
      </div>
      <Button className="mt-6 w-full shadow-sa" onClick={onCheckout}>Finalizar Pedido</Button>
    </div>
  )
}
