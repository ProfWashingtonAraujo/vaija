import type { ReactNode } from 'react'

export function ReportChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-sa-border bg-sa-surface p-5 shadow-sa">
      <h3 className="font-heading text-xl font-bold text-sa-text">{title}</h3>
      <div className="mt-5 h-[280px] rounded-xl border border-sa-border bg-sa-surface p-3">{children}</div>
    </div>
  )
}
