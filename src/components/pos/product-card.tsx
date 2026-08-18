import type { Product } from '@/data/mock-products'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'

export function ProductCard({ product, onAdd }: { product: Product; onAdd: (size?: 'P' | 'M' | 'G', price?: number) => void }) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-[28px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] shadow-[0_14px_34px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_18px_40px_rgba(255,107,0,0.1)]">
      <img src={product.image} alt={product.name} className="h-40 w-full object-cover sm:h-44" />
      <div className="flex flex-1 flex-col p-4">
        <span className="max-w-full self-start truncate rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{product.category}</span>
        <h3 className="mt-3 font-heading text-xl font-bold text-slate-900">{product.name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{product.description}</p>
        {product.sizePrices?.length ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {product.sizePrices.map((item) => (
              <button key={item.size} type="button" onClick={() => onAdd(item.size, item.price)} className="min-w-0 rounded-2xl border border-orange-100 bg-white px-2 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:bg-orange-50">
                {item.size} <span className="block font-mono text-xs text-slate-500">{formatCurrency(item.price)}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-4">
          <p className="truncate font-mono text-lg font-bold text-slate-900">{formatCurrency(product.price)}</p>
          <Button className="shrink-0 shadow-[0_12px_24px_rgba(255,107,0,0.18)]" onClick={() => onAdd()}>Adicionar</Button>
        </div>
      </div>
    </div>
  )
}
