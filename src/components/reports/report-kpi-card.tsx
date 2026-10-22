export function ReportKpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-sa-border bg-sa-surface p-5 shadow-sa">
      <p className="text-sm text-sa-muted">{label}</p>
      <p className="mt-3 font-heading text-2xl font-bold text-sa-text">{value}</p>
    </div>
  )
}
