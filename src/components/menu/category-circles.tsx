import { UtensilsCrossed } from 'lucide-react'
import { cn } from '@/lib/utils'

export type CategoryCircle = { name: string; image?: string }

/** Categorias em círculos com a foto de um produto, como nos apps de delivery. */
export function CategoryCircles({ categories, value, onChange }: { categories: CategoryCircle[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="scrollbar-thin -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {categories.map((category) => {
        const active = value === category.name
        return (
          <button key={category.name} type="button" onClick={() => onChange(category.name)} aria-pressed={active} className="flex w-[72px] shrink-0 snap-start flex-col items-center gap-1.5">
            <span className={cn('flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border-2 transition', active ? 'border-sa-accent bg-sa-accent text-white shadow-[0_10px_24px_rgba(0,0,0,0.15)]' : 'border-sa-border bg-sa-surface text-sa-accent-text')}>
              {category.image ? <img src={category.image} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed className="h-6 w-6" />}
            </span>
            <span className={cn('line-clamp-2 text-center text-[11px] font-semibold leading-tight', active ? 'text-sa-accent-text' : 'text-sa-text-2')}>{category.name}</span>
          </button>
        )
      })}
    </div>
  )
}
