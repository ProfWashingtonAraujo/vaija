export function ReportLegend({ items, colors, unit }: { items: Array<{ name: string; value: number }>; colors: string[]; unit: string }) {
  const total = items.reduce((sum, item) => sum + item.value, 0)
  return (
    <ul className="flex max-h-full min-w-0 flex-1 flex-col gap-1.5 overflow-y-auto py-1 pr-1 text-xs">
      {items.map((item, index) => (
        <li key={item.name} className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
          <span className="min-w-0 flex-1 truncate text-sa-text-2">{item.name}</span>
          <span className="shrink-0 font-semibold text-sa-text">{item.value} {unit}</span>
          <span className="w-9 shrink-0 text-right text-[11px] text-sa-muted">{total ? Math.round((item.value / total) * 100) : 0}%</span>
        </li>
      ))}
    </ul>
  )
}
