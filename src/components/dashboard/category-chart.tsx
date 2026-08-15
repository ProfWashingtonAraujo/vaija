import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { formatNumber } from '@/lib/formatters'

const COLORS = ['#ff6b00', '#f97316', '#fb923c', '#fbbf24', '#fcd34d']

function CustomTooltip({ active, payload }: { active?: boolean; payload?: Array<{ name: string; value: number; payload: { percent: number } }> }) {
  if (!active || !payload?.length) return null
  const item = payload[0]
  return (
    <div className="rounded-2xl border border-orange-100 bg-white px-4 py-3 shadow-[0_12px_32px_rgba(255,107,0,0.15)]">
      <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{item.name}</p>
      <p className="mt-1 font-heading text-lg font-bold text-orange-600">{formatNumber(item.value)} vendas</p>
      <p className="text-xs text-slate-400">{(item.payload.percent * 100).toFixed(1)}% do total</p>
    </div>
  )
}

export function CategoryChart({ data }: { data: Array<{ name: string; value: number }> }) {
  const total = data.reduce((sum, d) => sum + d.value, 0)
  const dataWithPercent = data.map((d) => ({ ...d, percent: total > 0 ? d.value / total : 0 }))

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <div className="relative flex-1">
        <ResponsiveContainer width="100%" height={240}>
          <PieChart>
            <Pie
              data={dataWithPercent}
              dataKey="value"
              nameKey="name"
              innerRadius={68}
              outerRadius={100}
              paddingAngle={3}
              isAnimationActive
              animationBegin={0}
              animationDuration={700}
              label={false}
            >
              {dataWithPercent.map((entry, index) => (
                <Cell key={entry.name} fill={COLORS[index % COLORS.length]} stroke="transparent" />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
        {total > 0 && (
          <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
            <p className="font-heading text-2xl font-extrabold text-slate-800">{formatNumber(total)}</p>
            <p className="text-xs font-medium text-slate-400">vendas</p>
          </div>
        )}
      </div>

      {data.length > 0 && (
        <div className="flex flex-col gap-2 sm:w-44">
          {dataWithPercent.map((entry, index) => (
            <div key={entry.name} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <span className="flex-1 truncate text-xs font-medium text-slate-600">{entry.name}</span>
              <span className="text-xs font-bold text-slate-800">{(entry.percent * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
