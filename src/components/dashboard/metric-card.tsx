import { Bike, ChartPie, Receipt, TrendingDown, TrendingUp, Wallet } from 'lucide-react'
import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatCurrency, formatNumber } from '@/lib/formatters'

const icons = {
  Wallet,
  Receipt,
  ChartPie,
  Bike,
}

/** Generates stable-looking fake sparkline data seeded from the metric value */
function generateSparkline(seed: number, points = 8): Array<{ v: number }> {
  let s = Math.abs(seed % 1000) || 1
  return Array.from({ length: points }, () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return { v: 30 + (Math.abs(s) % 70) }
  })
}

const trendColors = {
  up: { text: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  down: { text: 'text-rose-500', bg: 'bg-rose-50', border: 'border-rose-100' },
  neutral: { text: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-100' },
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
  const sparkData = generateSparkline(value)
  const colors = trendColors[trendDirection]
  const TrendIcon = trendDirection === 'up' ? TrendingUp : trendDirection === 'down' ? TrendingDown : null

  return (
    <div className="group relative overflow-hidden rounded-[28px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)] transition-all duration-300 hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_22px_48px_rgba(255,107,0,0.14)]">
      {/* Subtle glow on hover */}
      <div className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full bg-orange-400/10 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />

      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className="rounded-2xl border border-orange-100 bg-white p-3 text-orange-600 shadow-[0_10px_24px_rgba(255,107,0,0.08)]">
          <Icon className="h-4 w-4" />
        </div>
      </div>

      <p className="mt-4 font-heading text-3xl font-extrabold tracking-tight text-slate-900">
        {currency ? formatCurrency(value) : formatNumber(value)}
      </p>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${colors.bg} ${colors.border} ${colors.text}`}>
          {TrendIcon && <TrendIcon className="h-3 w-3" />}
          <span>{trend}</span>
        </div>

        {/* Mini Sparkline */}
        <div className="h-9 w-20 opacity-70">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sparkData} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
              <Tooltip content={() => null} />
              <Line
                type="monotone"
                dataKey="v"
                stroke={trendDirection === 'down' ? '#f43f5e' : '#ff6b00'}
                strokeWidth={2}
                dot={false}
                isAnimationActive
                animationDuration={800}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
