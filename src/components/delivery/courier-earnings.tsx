import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { Input } from '@/components/ui/input'
import { fetchCourierEarnings, type CourierEarnings } from '@/lib/delivery-api'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type PeriodKey = 'today' | 'yesterday' | 'week' | 'month' | 'lastMonth' | 'custom'

const periods: Array<[PeriodKey, string]> = [
  ['today', 'Hoje'],
  ['yesterday', 'Ontem'],
  ['week', 'Últimos 7 dias'],
  ['month', 'Este mês'],
  ['lastMonth', 'Mês passado'],
  ['custom', 'Personalizado'],
]

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
const addDays = (date: Date, days: number) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + days)
const toInputDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
const fromInputDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day)
}

/** Início e fim (exclusivo) do período, no horário local de quem está usando o painel. */
function rangeFor(key: PeriodKey, customStart: string, customEnd: string): [Date, Date] | null {
  const today = startOfDay(new Date())
  switch (key) {
    case 'today': return [today, addDays(today, 1)]
    case 'yesterday': return [addDays(today, -1), today]
    case 'week': return [addDays(today, -6), addDays(today, 1)]
    case 'month': return [new Date(today.getFullYear(), today.getMonth(), 1), addDays(today, 1)]
    case 'lastMonth': return [new Date(today.getFullYear(), today.getMonth() - 1, 1), new Date(today.getFullYear(), today.getMonth(), 1)]
    case 'custom': {
      if (!customStart || !customEnd) return null
      const start = fromInputDate(customStart)
      const end = addDays(fromInputDate(customEnd), 1)
      return end > start ? [start, end] : null
    }
  }
}

function formatDateTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
}

/** Fechamento do repasse: quanto pagar a cada entregador no período (% da taxa de entrega das entregas finalizadas). */
export function CourierEarningsPanel() {
  const [period, setPeriod] = useState<PeriodKey>('today')
  const [customStart, setCustomStart] = useState(() => toInputDate(addDays(new Date(), -6)))
  const [customEnd, setCustomEnd] = useState(() => toInputDate(new Date()))
  const [data, setData] = useState<CourierEarnings | null>(null)
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)

  const range = useMemo(() => rangeFor(period, customStart, customEnd), [period, customStart, customEnd])

  useEffect(() => {
    if (!range) return
    let active = true
    setLoading(true)
    void fetchCourierEarnings(range[0].toISOString(), range[1].toISOString())
      .then((result) => { if (active) setData(result) })
      .catch(() => { if (active) toast.error('Não foi possível carregar o repasse dos entregadores.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [range])

  const percent = data ? String(data.percent).replace('.', ',') : '80'
  const cards = [
    { label: 'Entregas finalizadas', value: String(data?.totals.count ?? 0) },
    { label: 'Taxas cobradas', value: formatCurrency(data?.totals.fees ?? 0) },
    { label: `A pagar aos entregadores (${percent}%)`, value: formatCurrency(data?.totals.pay ?? 0), highlight: true },
    { label: 'Fica com a loja', value: formatCurrency(data?.totals.store ?? 0) },
  ]

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        {periods.map(([key, label]) => (
          <button key={key} type="button" onClick={() => setPeriod(key)} className={cn('rounded-full border px-3 py-1.5 text-sm font-semibold transition', period === key ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-orange-100 bg-white text-slate-600 hover:border-orange-300')}>{label}</button>
        ))}
        {period === 'custom' ? (
          <div className="flex flex-wrap items-center gap-2">
            <Input type="date" value={customStart} max={customEnd} onChange={(event) => setCustomStart(event.target.value)} aria-label="De" className="h-9 w-40" />
            <span className="text-sm text-slate-400">até</span>
            <Input type="date" value={customEnd} min={customStart} onChange={(event) => setCustomEnd(event.target.value)} aria-label="Até" className="h-9 w-40" />
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, highlight }) => (
          <div key={label} className={cn('rounded-[28px] border bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]', highlight ? 'border-orange-300' : 'border-orange-100')}>
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className={cn('mt-4 font-heading text-3xl font-bold', highlight ? 'text-orange-600' : 'text-slate-900')}>{loading && !data ? '…' : value}</p>
          </div>
        ))}
      </div>

      <section className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <h3 className="font-heading text-xl font-bold text-slate-900">Por entregador</h3>
        <p className="mt-1 text-sm text-slate-500">Conta só entregas finalizadas no período. O valor de cada entrega fica guardado na hora em que ela termina, então mudar a porcentagem depois não altera o histórico.</p>
        <div className="mt-4 space-y-3">
          {!range ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-center text-sm text-slate-500">Escolha uma data inicial e uma final.</p> : null}
          {range && !loading && data && data.couriers.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-center text-sm text-slate-500">Nenhuma entrega finalizada neste período.</p> : null}
          {data?.couriers.map((courier) => {
            const key = courier.name || '__none__'
            const expanded = open === key
            return (
              <div key={key} className="rounded-2xl border border-orange-100">
                <button type="button" onClick={() => setOpen(expanded ? null : key)} aria-expanded={expanded} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left">
                  <div>
                    <p className="font-semibold text-slate-900">{courier.name || 'Sem entregador informado'}</p>
                    <p className="text-sm text-slate-500">{courier.count} {courier.count === 1 ? 'entrega' : 'entregas'} · taxas {formatCurrency(courier.fees)} · loja {formatCurrency(courier.store)}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">A pagar</p>
                      <p className="font-mono text-lg font-bold text-orange-600">{formatCurrency(courier.pay)}</p>
                    </div>
                    <ChevronDown className={cn('h-5 w-5 text-slate-400 transition', expanded && 'rotate-180')} />
                  </div>
                </button>
                {expanded ? (
                  <div className="overflow-x-auto border-t border-orange-100">
                    <table className="w-full min-w-[420px] text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                          <th className="px-4 py-2 font-semibold">Pedido</th>
                          <th className="px-4 py-2 font-semibold">Finalizada</th>
                          <th className="px-4 py-2 text-right font-semibold">Taxa</th>
                          <th className="px-4 py-2 text-right font-semibold">Repasse</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courier.deliveries.map((delivery) => (
                          <tr key={delivery.orderId} className="border-t border-orange-50">
                            <td className="px-4 py-2 text-slate-700">#{delivery.orderId} · {delivery.customer}</td>
                            <td className="px-4 py-2 text-slate-500">{formatDateTime(delivery.finishedAt)}</td>
                            <td className="px-4 py-2 text-right font-mono text-slate-600">{formatCurrency(delivery.fee)}</td>
                            <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{formatCurrency(delivery.pay)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            )
          })}
        </div>
      </section>
    </div>
  )
}
