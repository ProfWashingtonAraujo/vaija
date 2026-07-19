import type { Product } from '@/data/mock-products'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'

export function ProductCard({ product, onAdd }: { product: Product; onAdd: () => void }) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] shadow-[0_14px_34px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_18px_40px_rgba(255,107,0,0.12)]">
      <img src={product.image} alt={product.name} className="h-44 w-full object-cover" />
      <div className="p-4">
        <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{product.category}</span>
        <h3 className="mt-3 font-heading text-xl font-bold text-slate-900">{product.name}</h3>
        <p className="mt-2 text-sm leading-6 text-slate-500">{product.description}</p>
        <div className="mt-5 flex items-center justify-between gap-3">
          <p className="font-mono text-lg font-bold text-slate-900">{formatCurrency(product.price)}</p>
          <Button className="shadow-[0_12px_24px_rgba(255,107,0,0.18)]" onClick={onAdd}>Adicionar</Button>
        </div>
      </div>
    </div>
  )
}
