import { cn } from '@/lib/utils'

const styles = {
  Pendente: 'bg-amber-50 text-amber-700 border-amber-200',
  'Em preparo': 'bg-orange-50 text-orange-700 border-orange-200',
  'Em producao': 'bg-orange-50 text-orange-700 border-orange-200',
  'Saiu para entrega': 'bg-sky-50 text-sky-700 border-sky-200',
  Entregue: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Cancelado: 'bg-rose-50 text-rose-700 border-rose-200',
  'Pronto para retirada': 'bg-violet-50 text-violet-700 border-violet-200',
} as const

const labels: Record<keyof typeof styles, string> = {
  Pendente: 'Pendente',
  'Em preparo': 'Em preparo',
  'Em producao': 'Em produção',
  'Saiu para entrega': 'Saiu para entrega',
  Entregue: 'Entregue',
  Cancelado: 'Cancelado',
  'Pronto para retirada': 'Pronto para retirada',
}

export function StatusBadge({ status }: { status: keyof typeof styles }) {
  return <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em] sm:text-xs', styles[status])}>{labels[status]}</span>
}
