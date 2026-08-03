import { cn } from '@/lib/utils'

export function PaymentMethodSelector({ value, onChange }: { value: string; onChange: (value: 'Pix' | 'Cartão' | 'Dinheiro') => void }) {
  return (
    <div className="grid grid-cols-3 gap-2 rounded-[24px] border border-orange-100 bg-white/80 p-2">
      {(['Pix', 'Cartão', 'Dinheiro'] as const).map((method) => (
        <button key={method} onClick={() => onChange(method)} className={cn('rounded-2xl border px-3 py-2 text-sm font-semibold transition-all duration-200', value === method ? 'border-orange-300 bg-orange-50 text-orange-700 shadow-[0_8px_18px_rgba(255,107,0,0.08)]' : 'border-orange-100 bg-white text-slate-600 hover:border-orange-200')}>
          {method}
        </button>
      ))}
    </div>
  )
}
