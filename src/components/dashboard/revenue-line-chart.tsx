import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/formatters'

const GRADIENT_ID = 'revenueAreaGradient'

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-sa-border bg-sa-surface px-4 py-3 shadow-sa">
      <p className="text-xs font-semibold uppercase tracking-widest text-sa-soft">{label}</p>
      <p className="mt-1 font-heading text-lg font-bold text-sa-accent-text">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function RevenueLineChart({ data }: { data: Array<{ day: string; revenue: number }> }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 16, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff6b00" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#ff6b00" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--sa-border)" strokeDasharray="4 4" />
        <XAxis
          dataKey="day"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 12, fill: 'var(--sa-muted)', fontWeight: 500 }}
        />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={64}
          tick={{ fontSize: 11, fill: 'var(--sa-muted)' }}
          tickFormatter={(v: number) => `R$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}`}
        />
        <Tooltip content={<CustomTooltip />} cursor={{ stroke: '#ff6b00', strokeWidth: 1.5, strokeDasharray: '4 4' }} />
        <Area
          type="monotone"
          dataKey="revenue"
          stroke="#ff6b00"
          strokeWidth={2.5}
          fill={`url(#${GRADIENT_ID})`}
          dot={{ r: 4, fill: '#ff6b00', strokeWidth: 2, stroke: 'var(--sa-surface)' }}
          activeDot={{ r: 6, fill: '#ff6b00', stroke: 'var(--sa-surface)', strokeWidth: 2 }}
          isAnimationActive
          animationDuration={800}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}
