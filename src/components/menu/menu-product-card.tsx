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
        'min-w-0 cursor-grab overflow-hidden rounded-2xl border bg-sa-surface shadow-sa transition hover:-translate-y-1 hover:border-sa-border-strong hover:shadow-sa active:cursor-grabbing',
        dragging ? 'scale-[0.98] opacity-70' : 'border-sa-border',
        dropTarget ? 'border-sa-border-strong shadow-sa' : '',
      )}
    >
      <img src={product.image} alt={product.name} className="h-32 w-full object-cover sm:h-36" />
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate rounded-full border border-sa-border bg-sa-accent-soft px-3 py-1 text-xs font-semibold text-sa-accent-text">{product.category}</span>
          <button type="button" role="switch" aria-checked={product.available} aria-label={`Marcar ${product.name} como ${product.available ? 'indisponível' : 'disponível'}`} onClick={onToggle} className={`relative h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus:ring-2 focus:ring-sa-accent/20 focus:ring-offset-2 ${product.available ? 'bg-sa-accent shadow-sa' : 'bg-sa-border-strong'}`}>
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-sa-surface transition ${product.available ? 'left-6' : 'left-1'}`} />
          </button>
        </div>
        <h3 className="mt-3 font-heading text-xl font-bold text-sa-text">{product.name}</h3>
        <p className="mt-2 text-sm leading-6 text-sa-muted">{product.description}</p>
        {product.blockedBy?.length ? <p className="mt-2 rounded-xl bg-sa-bad-soft px-3 py-2 text-xs font-semibold text-sa-bad">Fora do cardápio: falta {product.blockedBy.join(', ')}</p> : null}
        {product.sizePrices?.length ? (
          <div className="mt-4 grid grid-cols-3 gap-2">
            {product.sizePrices.map((item) => (
              <div key={item.size} className="rounded-2xl border border-sa-border bg-sa-surface px-2 py-2 text-center text-sm font-semibold text-sa-text-2">
                {item.size} <span className="block font-mono text-xs text-sa-muted">{formatCurrency(item.price)}</span>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-4 flex items-center justify-between">
          <span className="font-mono text-lg font-bold text-sa-text">{formatCurrency(product.price)}</span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${product.blockedBy?.length ? 'bg-sa-bad-soft text-sa-bad' : product.available ? 'bg-sa-ok-soft text-sa-ok' : 'bg-sa-hover text-sa-muted'}`}>{product.blockedBy?.length ? 'Em falta' : product.available ? 'Disponível' : 'Indisponível'}</span>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="outline" onClick={onEdit}>Editar</Button>
          <Button type="button" variant="outline" className="border-sa-border text-sa-bad hover:border-sa-bad hover:text-sa-bad" onClick={onDelete}>Excluir</Button>
        </div>
      </div>
    </div>
  )
}
