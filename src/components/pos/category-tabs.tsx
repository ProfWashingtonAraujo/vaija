import { cn } from '@/lib/utils'

type CategoryTabsProps = {
  categories: readonly string[]
  value: string
  onChange: (value: string) => void
  dropTargetCategory?: string | null
  onDragEnterCategory?: (category: string) => void
  onDropCategory?: (category: string) => void
}

export function CategoryTabs({ categories, value, onChange, dropTargetCategory, onDragEnterCategory, onDropCategory }: CategoryTabsProps) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-[24px] border border-orange-100 bg-white/70 p-2 pb-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      {categories.map((category) => (
        <button
          key={category}
          onClick={() => onChange(category)}
          onDragOver={(event) => {
            if (onDropCategory) {
              event.preventDefault()
            }
          }}
          onDragEnter={() => onDragEnterCategory?.(category)}
          onDrop={(event) => {
            if (!onDropCategory) {
              return
            }

            event.preventDefault()
            event.stopPropagation()
            onDropCategory(category)
          }}
          className={cn(
            'whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200',
            value === category ? 'border-orange-300 bg-orange-50 text-orange-700 shadow-[0_8px_18px_rgba(255,107,0,0.08)]' : 'border-orange-100 bg-white text-slate-600 hover:border-orange-200',
            dropTargetCategory === category ? 'border-orange-300 ring-4 ring-orange-100' : '',
          )}
        >
          {category}
        </button>
      ))}
    </div>
  )
}
