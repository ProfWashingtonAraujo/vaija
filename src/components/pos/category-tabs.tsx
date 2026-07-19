import { cn } from '@/lib/utils'

export function CategoryTabs({ categories, value, onChange }: { categories: readonly string[]; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto rounded-[24px] border border-orange-100 bg-white/70 p-2 pb-2 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      {categories.map((category) => (
        <button key={category} onClick={() => onChange(category)} className={cn('whitespace-nowrap rounded-full border px-4 py-2 text-sm font-semibold transition-all duration-200', value === category ? 'border-orange-300 bg-orange-50 text-orange-700 shadow-[0_8px_18px_rgba(255,107,0,0.08)]' : 'border-orange-100 bg-white text-slate-600 hover:border-orange-200')}>
          {category}
        </button>
      ))}
    </div>
  )
}
