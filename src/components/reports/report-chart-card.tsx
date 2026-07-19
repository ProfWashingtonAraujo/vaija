import type { ReactNode } from 'react'

export function ReportChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <h3 className="font-heading text-xl font-bold text-slate-900">{title}</h3>
      <div className="mt-5 h-[280px] rounded-[24px] border border-orange-100 bg-white/80 p-3">{children}</div>
    </div>
  )
}
