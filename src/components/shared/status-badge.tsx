import { cn } from '@/lib/utils'

const styles = {
  Pendente: 'bg-sa-warn-soft text-sa-warn',
  'Em preparo': 'bg-sa-accent-soft text-sa-accent-text',
  'Em producao': 'bg-sa-accent-soft text-sa-accent-text',
  'Saiu para entrega': 'bg-sa-info-soft text-sa-info',
  Entregue: 'bg-sa-ok-soft text-sa-ok',
  Cancelado: 'bg-sa-bad-soft text-sa-bad',
  'Pronto para retirada': 'bg-sa-violet-soft text-sa-violet',
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
  return <span className={cn('rounded-full px-2.5 py-1 text-[11px] font-semibold tracking-[0.01em] sm:text-xs', styles[status])}>{labels[status]}</span>
}
