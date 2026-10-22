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
    <div className="scrollbar-thin flex snap-x gap-2 overflow-x-auto rounded-xl border border-sa-border bg-sa-surface p-1.5 shadow-sa sm:rounded-xl sm:p-2">
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
            'snap-start whitespace-nowrap rounded-full border px-3 py-2 text-xs font-semibold transition-all duration-200 sm:px-4 sm:text-sm',
            value === category ? 'border-sa-border-strong bg-sa-accent-soft text-sa-accent-text shadow-sa' : 'border-sa-border bg-sa-surface text-sa-text-2 hover:border-sa-border-strong',
            dropTargetCategory === category ? 'border-sa-border-strong ring-4 focus:ring-sa-accent/20' : '',
          )}
        >
          {category}
        </button>
      ))}
    </div>
  )
}
