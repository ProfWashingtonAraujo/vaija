import { cn } from '@/lib/utils'

export function PaymentMethodSelector({ value, onChange }: { value: string; onChange: (value: 'Pix' | 'Cartão' | 'Dinheiro') => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-xl border border-sa-border bg-sa-surface p-2">
      {(['Pix', 'Cartão', 'Dinheiro'] as const).map((method) => (
        <button key={method} onClick={() => onChange(method)} className={cn('rounded-2xl border px-3 py-2 text-sm font-semibold transition-all duration-200', value === method ? 'border-sa-border-strong bg-sa-accent-soft text-sa-accent-text shadow-sa' : 'border-sa-border bg-sa-surface text-sa-text-2 hover:border-sa-border-strong')}>
          {method}
        </button>
      ))}
    </div>
  )
}
