import type { Product } from '@/data/mock-products'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type MenuProductCardProps = {
  product: Product
  dragging?: boolean
  dropTarget?: boolean
  onToggle: () => void
  onEdit: () => void
  onDelete: () => void
  onDragStart: () => void
  onDragEnd: () => void
  onDragEnter: () => void
  onDrop: () => void
}

export function MenuProductCard({ product, dragging, dropTarget, onToggle, onEdit, onDelete, onDragStart, onDragEnd, onDragEnter, onDrop }: MenuProductCardProps) {
  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = 'move'
        event.dataTransfer.setData('text/plain', product.id)
        onDragStart()
      }}
      onDragEnd={onDragEnd}
      onDragOver={(event) => event.preventDefault()}
      onDragEnter={onDragEnter}
      onDrop={(event) => {
        event.preventDefault()
        event.stopPropagation()
        onDrop()
      }}
      className={cn(
        'cursor-grab overflow-hidden rounded-[28px] border bg-gradient-to-br from-white to-[#fffaf5] shadow-[0_14px_34px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_18px_40px_rgba(255,107,0,0.1)] active:cursor-grabbing',
        dragging ? 'scale-[0.98] opacity-70' : 'border-orange-100',
        dropTarget ? 'border-orange-300 shadow-[0_18px_40px_rgba(255,107,0,0.14)]' : '',
      )}
    >
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
        {product.sizePrices?.length ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {product.sizePrices.map((item) => (
              <div key={item.size} className="rounded-2xl border border-orange-100 bg-white px-2 py-2 text-center text-sm font-semibold text-slate-700">
                {item.size} <span className="block font-mono text-xs text-slate-500">{formatCurrency(item.price)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-lg font-bold text-slate-900">{formatCurrency(product.price)}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.available ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{product.available ? 'Disponível' : 'Indisponível'}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onEdit}>Editar</Button>
          <Button type="button" variant="outline" className="border-rose-200 text-rose-700 hover:border-rose-300 hover:text-rose-800" onClick={onDelete}>Excluir</Button>
        </div>
      </div>
    </div>
  )
}
