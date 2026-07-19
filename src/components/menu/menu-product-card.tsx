import type { Product } from '@/data/mock-products'
import { formatCurrency } from '@/lib/formatters'

export function MenuProductCard({ product, onToggle }: { product: Product; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] shadow-[0_14px_34px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_18px_40px_rgba(255,107,0,0.1)]">
      <img src={product.image} alt={product.name} className="h-40 w-full object-cover" />
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{product.category}</span>
           <button onClick={onToggle} className={`relative h-7 w-12 rounded-full transition ${product.available ? 'bg-orange-500 shadow-[0_8px_18px_rgba(255,107,0,0.2)]' : 'bg-slate-200'}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white transition ${product.available ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        <h3 className="mt-3 font-heading text-xl font-bold text-slate-900">{product.name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{product.description}</p>
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-lg font-bold text-slate-900">{formatCurrency(product.price)}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{product.available ? 'Disponível' : 'Indisponível'}</span>
        </div>
      </div>
    </div>
  )
}
