import type { Product } from '@/data/mock-products'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'

export function ProductCard({ product, onAdd }: { product: Product; onAdd: (size?: 'P' | 'M' | 'G', price?: number) => void }) {
  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-[20px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] shadow-[0_10px_24px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_18px_40px_rgba(255,107,0,0.12)] sm:rounded-[28px] sm:shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <img src={product.image} alt={product.name} className="aspect-[4/3] w-full object-cover sm:h-44 sm:aspect-auto" />
      <div className="flex flex-1 flex-col p-3 sm:p-4">
        <span className="max-w-full self-start truncate rounded-full border border-orange-200 bg-orange-50 px-2 py-0.5 text-[10px] font-semibold text-orange-700 sm:px-3 sm:py-1 sm:text-xs">{product.category}</span>
        <h3 className="mt-2 line-clamp-2 min-h-10 font-heading text-sm font-bold leading-5 text-slate-900 sm:mt-3 sm:min-h-0 sm:text-xl sm:leading-normal">{product.name}</h3>
        <p className="mt-2 hidden text-sm leading-6 text-slate-500 sm:block">{product.description}</p>
        {product.sizePrices?.length ? (
          <div className="mt-3 grid grid-cols-3 gap-1 sm:mt-4 sm:gap-2">
            {product.sizePrices.map((item) => (
              <button key={item.size} type="button" onClick={() => onAdd(item.size, item.price)} className="min-w-0 rounded-xl border border-orange-100 bg-white px-1 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 sm:rounded-2xl sm:px-2 sm:py-2 sm:text-sm">
                {item.size}
                <span className="block font-mono text-[9px] text-slate-500 sm:hidden">{item.price.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}</span>
                <span className="hidden font-mono text-xs text-slate-500 sm:block">{formatCurrency(item.price)}</span>
              </button>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex flex-col gap-2 pt-3 sm:mt-5 sm:flex-row sm:items-center sm:justify-between sm:gap-3 sm:pt-0">
          <p className="truncate font-mono text-sm font-bold text-slate-900 sm:text-lg">{formatCurrency(product.price)}</p>
          <Button className="w-full px-2 py-2 text-xs shadow-[0_12px_24px_rgba(255,107,0,0.18)] sm:w-auto sm:px-4 sm:py-2.5 sm:text-sm" onClick={() => onAdd()}>Adicionar</Button>
        </div>
      </div>
    </div>
  )
}
