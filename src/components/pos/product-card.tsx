import type { Product } from '@/data/mock-products'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'

export function ProductCard({ product, onAdd, onHalf }: { product: Product; onAdd: (size?: 'P' | 'M' | 'G', price?: number) => void; onHalf?: () => void }) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-2xl border border-sa-border bg-sa-surface shadow-sa transition hover:-translate-y-1 hover:border-sa-border-strong hover:shadow-sa">
      <img src={product.image} alt={product.name} className="h-40 w-full object-cover sm:h-44" />
      <div className="flex flex-1 flex-col p-4">
        <span className="max-w-full self-start truncate rounded-full border border-sa-border bg-sa-accent-soft px-3 py-1 text-xs font-semibold text-sa-accent-text">{product.category}</span>
        <h3 className="mt-3 font-heading text-xl font-bold text-sa-text">{product.name}</h3>
        <p className="mt-2 text-sm leading-6 text-sa-muted">{product.description}</p>
        {product.sizePrices?.length ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {product.sizePrices.map((item) => (
              <button key={item.size} type="button" onClick={() => onAdd(item.size, item.price)} className="min-w-0 rounded-2xl border border-sa-border bg-sa-surface px-2 py-2 text-sm font-semibold text-sa-text-2 transition hover:border-sa-border-strong hover:bg-sa-hover">
                {item.size} <span className="block font-mono text-xs text-sa-muted">{formatCurrency(item.price)}</span>
              </button>
            ))}
          </div>
        ) : null}
        {onHalf && product.sizePrices?.length ? (
          <button type="button" onClick={onHalf} className="mt-2 w-full rounded-2xl border border-dashed border-sa-border-strong bg-sa-surface-2 px-3 py-2 text-sm font-semibold text-sa-accent-text transition hover:bg-sa-hover">Meio a meio</button>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <p className="truncate font-mono text-lg font-bold text-sa-text">{formatCurrency(product.price)}</p>
          <Button className="shrink-0 shadow-sa" onClick={() => onAdd()}>Adicionar</Button>
        </div>
      </div>
    </div>
  )
}
