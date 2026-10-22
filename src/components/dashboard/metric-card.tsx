import { Bike, ChartPie, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/formatters'

const icons = {
  Wallet,
  Receipt,
  ChartPie,
  Bike,
}

const trendColors = {
  up: 'bg-sa-ok-soft text-sa-ok',
  down: 'bg-sa-bad-soft text-sa-bad',
  neutral: 'bg-sa-hover text-sa-muted',
}

export function MetricCard({
  label,
  value,
  trend,
  icon,
  currency = false,
  trendDirection = 'neutral',
}: {
  label: string
  value: number
  trend: string
  icon: keyof typeof icons
  currency?: boolean
  trendDirection?: 'up' | 'down' | 'neutral'
}) {
  const Icon = icons[icon]
  const colors = trendColors[trendDirection]
  const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : null

  return (
    <div className="rounded-2xl border border-sa-border bg-sa-surface p-5 shadow-sa">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold text-sa-muted">{label}</span>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-sa-accent-soft text-sa-accent-text">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-3 font-heading text-2xl font-bold text-sa-text sm:text-3xl">
        {currency ? formatCurrency(value) : formatNumber(value)}
      </p>

      <div className={`mt-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${colors}`}>
        {TrendIcon && <TrendIcon className="h-3 w-3" />}
        <span>{trend}</span>
      </div>
    </div>
  )
}
