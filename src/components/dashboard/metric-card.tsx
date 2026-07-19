import { Bike, ChartPie, Receipt, Wallet } from 'lucide-react'
import { formatCurrency, formatNumber } from '@/lib/formatters'

const icons = {
  Wallet,
  Receipt,
  ChartPie,
  Bike,
}

export function MetricCard({ label, value, trend, icon, currency = false }: { label: string; value: number; trend: string; icon: keyof typeof icons; currency?: boolean }) {
  const Icon = icons[icon]

  return (
    <div className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_18px_40px_rgba(255,107,0,0.12)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-500">{label}</span>
        <div className="rounded-2xl border border-orange-100 bg-white p-3 text-orange-600 shadow-[0_10px_24px_rgba(255,107,0,0.08)]">
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-5 font-mono text-3xl font-bold text-slate-900">{currency ? formatCurrency(value) : formatNumber(value)}</p>
      <p className="mt-2 text-sm text-slate-500">{trend}</p>
    </div>
  )
}
