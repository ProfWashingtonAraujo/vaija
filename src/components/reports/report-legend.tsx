export function ReportLegend({ items, colors, unit }: { items: Array<{ name: string; value: number }>; colors: string[]; unit: string }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  return (
    <ul className="flex h-full min-w-0 flex-1 flex-col justify-center gap-2 overflow-y-auto pr-1 text-sm">
      {items.map((item, index) => (
        <li key={item.name} className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
          <span className="min-w-0 flex-1 truncate text-slate-700">{item.name}</span>
          <span className="shrink-0 font-semibold text-slate-900">{item.value} {unit}</span>
          <span className="w-10 shrink-0 text-right text-xs text-slate-500">{total ? Math.round((item.value / total) * 100) : 0}%</span>
        </li>
      ))}
    </ul>
  )
}
