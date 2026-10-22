import { useEffect, useMemo, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import type { Product } from '@/data/mock-products'
import { formatCurrency } from '@/lib/formatters'
import {
  buildHalfAndHalfItem,
  halfAndHalfRules,
  isHalfEligible,
  pizzaSizeLabels,
  pizzaSizes,
  sizesInCommon,
  type HalfAndHalfItem,
  type PizzaSize,
} from '@/lib/half-and-half'

type HalfAndHalfDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  products: Product[]
  /** Pizza em que o cliente clicou; já entra como 1ª metade. */
  initialProduct?: Product
  onConfirm: (item: HalfAndHalfItem) => void
}

const selectClass = 'mt-1 h-11 w-full rounded-2xl border border-sa-border bg-sa-surface px-3 text-sm font-semibold text-sa-text outline-none focus:border-sa-accent focus:ring-2 focus:ring-sa-accent/20'

export function HalfAndHalfDialog({ open, onOpenChange, products, initialProduct, onConfirm }: HalfAndHalfDialogProps) {
  const pizzas = useMemo(() => products.filter(isHalfEligible), [products])
  const [firstId, setFirstId] = useState('')
  const [secondId, setSecondId] = useState('')
  const [size, setSize] = useState<PizzaSize>('M')

  useEffect(() => {
    if (!open) return
    setFirstId(initialProduct?.id ?? '')
    setSecondId('')
    setSize('M')
  }, [open, initialProduct])

  const first = pizzas.find((product) => product.id === firstId)
  const second = pizzas.find((product) => product.id === secondId)
  const availableSizes = first && second ? sizesInCommon(first, second) : pizzaSizes
  const effectiveSize = availableSizes.includes(size) ? size : availableSizes[0]
  const item = first && second && effectiveSize ? buildHalfAndHalfItem(first, second, effectiveSize) : undefined

  const byCategory = (excludeId: string) => {
    const groups = new Map<string, Product[]>()
    for (const product of pizzas) {
      if (product.id === excludeId) continue
      groups.set(product.category, [...(groups.get(product.category) ?? []), product])
    }
    return [...groups.entries()]
  }

  const renderOptions = (excludeId: string) => byCategory(excludeId).map(([category, items]) => (
    <optgroup key={category} label={category}>
      {items.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}
    </optgroup>
  ))

  const confirm = () => {
    if (!item) return
    onConfirm(item)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogPrimitive.Title className="font-heading text-2xl font-bold text-sa-text">Pizza meio a meio</DialogPrimitive.Title>
        <DialogPrimitive.Description className="mt-1 text-sm text-sa-muted">
          Escolha o tamanho e dois sabores. {halfAndHalfRules.pricing === 'average' ? 'Cobrado pela média dos dois sabores.' : 'Cobrado pelo sabor mais caro.'}
        </DialogPrimitive.Description>

        <div className="mt-5">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-sa-soft">Tamanho</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {pizzaSizes.map((option) => {
              const enabled = availableSizes.includes(option)
              const active = effectiveSize === option
              return (
                <button
                  key={option}
                  type="button"
                  disabled={!enabled}
                  aria-pressed={active}
                  onClick={() => setSize(option)}
                  className={`rounded-2xl border px-2 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${active ? 'border-sa-accent bg-sa-accent text-white' : 'border-sa-border bg-sa-surface text-sa-text-2 hover:border-sa-border-strong'}`}
                >
                  {pizzaSizeLabels[option]}
                </button>
              )
            })}
          </div>
        </div>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-sa-soft">
          1ª metade
          <select className={selectClass} value={firstId} onChange={(event) => setFirstId(event.target.value)}>
            <option value="">Escolha o sabor…</option>
            {renderOptions(secondId)}
          </select>
        </label>

        <label className="mt-4 block text-xs font-semibold uppercase tracking-[0.14em] text-sa-soft">
          2ª metade
          <select className={selectClass} value={secondId} onChange={(event) => setSecondId(event.target.value)}>
            <option value="">Escolha o sabor…</option>
            {renderOptions(firstId)}
          </select>
        </label>

        {first && second && !availableSizes.length ? (
          <p className="mt-4 rounded-2xl border border-sa-border bg-sa-bad-soft p-3 text-sm font-semibold text-sa-bad">Esses dois sabores não têm um tamanho em comum.</p>
        ) : null}

        <div className="mt-5 rounded-2xl border border-sa-border bg-sa-surface-2 p-4">
          {item && first && second && effectiveSize ? (
            <>
              <p className="text-sm font-semibold text-sa-text">1/2 {first.name} + 1/2 {second.name}</p>
              <p className="mt-1 text-xs text-sa-muted">{pizzaSizeLabels[effectiveSize]}</p>
              <p className="mt-2 font-mono text-2xl font-bold text-sa-text">{formatCurrency(item.price)}</p>
            </>
          ) : (
            <p className="text-sm text-sa-muted">Escolha as duas metades para ver o preço.</p>
          )}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="button" disabled={!item} onClick={confirm}>Adicionar ao pedido</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
