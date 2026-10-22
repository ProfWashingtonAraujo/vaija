import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatCurrency } from '@/lib/formatters'

const GRADIENT_ID = 'revenueBarGradient'

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-xl border border-sa-border bg-sa-surface px-4 py-3 shadow-sa">
      <p className="text-xs font-semibold uppercase tracking-widest text-sa-soft">{label}</p>
      <p className="mt-1 font-heading text-lg font-bold text-sa-accent-text">{formatCurrency(payload[0].value)}</p>
    </div>
  )
}

export function RevenueChart({ data }: { data: Array<{ day: string; revenue: number }> }) {
  const hasData = data.length > 0
  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} barCategoryGap="35%" margin={{ top: 24, right: 8, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={GRADIENT_ID} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff6b00" stopOpacity={1} />
            <stop offset="100%" stopColor="#ffb26b" stopOpacity={0.85} />
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
        <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--sa-hover)', radius: 10 }} />
        <Bar dataKey="revenue" radius={[10, 10, 0, 0]} isAnimationActive maxBarSize={52}>
          {hasData && (
            <LabelList
              dataKey="revenue"
              position="top"
              formatter={(v: number) => (v > 0 ? `R$${v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v}` : '')}
              style={{ fontSize: 10, fill: 'var(--sa-accent-text)', fontWeight: 700 }}
            />
          )}
          {data.map((entry) => (
            <Cell key={entry.day} fill={`url(#${GRADIENT_ID})`} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
