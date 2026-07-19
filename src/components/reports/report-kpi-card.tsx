export function ReportKpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-3 font-heading text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}
