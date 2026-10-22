import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { PayCourierDialog, type PayTarget } from '@/components/delivery/pay-courier-dialog'
import { createCourierPayout, fetchCourierEarnings, fetchCourierPayouts, payoutErrorMessage, undoCourierPayout, type CourierEarnings, type CourierPayout } from '@/lib/delivery-api'
import { cashRegisterUpdatedEvent, fetchCashRegister, readCashRegister, type CashRegisterState } from '@/lib/cash-register'
import { csvNumber, csvText, downloadCsv } from '@/lib/csv'
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

const NO_COURIER = 'Sem entregador informado'

function formatDateTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
}

function formatDateLong(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString('pt-BR') : '—'
}

/** Planilha do repasse aos entregadores. */
function downloadEarningsCsv(data: CourierEarnings, range: [Date, Date]) {
  const header = ['Entregador', 'Pedido', 'Cliente', 'Finalizada em', 'Taxa de entrega', 'Repasse', 'Situação']
  const lines = [header.map(csvText).join(';')]
  for (const courier of data.couriers) {
    for (const delivery of courier.deliveries) {
      lines.push([
        csvText(courier.name || NO_COURIER),
        String(delivery.orderId),
        csvText(delivery.customer),
        csvText(formatDateTime(delivery.finishedAt)),
        csvNumber(delivery.fee),
        csvNumber(delivery.pay),
        csvText(delivery.paid ? 'Pago' : 'A pagar'),
      ].join(';'))
    }
  }
  lines.push('')
  lines.push(['Entregador', 'Entregas', 'Taxas', 'Repasse total', 'Pago', 'A pagar', 'Fica com a loja'].map(csvText).join(';'))
  for (const courier of data.couriers) {
    lines.push([csvText(courier.name || NO_COURIER), String(courier.count), csvNumber(courier.fees), csvNumber(courier.pay), csvNumber(courier.paid), csvNumber(courier.pending), csvNumber(courier.store)].join(';'))
  }
  const totals = data.totals
  lines.push([csvText('TOTAL'), String(totals.count), csvNumber(totals.fees), csvNumber(totals.pay), csvNumber(totals.paid), csvNumber(totals.pending), csvNumber(totals.store)].join(';'))

  downloadCsv(`repasse-entregadores_${toInputDate(range[0])}_a_${toInputDate(addDays(range[1], -1))}.csv`, lines)
}

/** Fechamento do repasse: quanto pagar a cada entregador no período, com registro de pagamentos e planilha. */
export function CourierEarningsPanel() {
  const [period, setPeriod] = useState<PeriodKey>('today')
  const [customStart, setCustomStart] = useState(() => toInputDate(addDays(new Date(), -6)))
  const [customEnd, setCustomEnd] = useState(() => toInputDate(new Date()))
  const [data, setData] = useState<CourierEarnings | null>(null)
  const [payouts, setPayouts] = useState<CourierPayout[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState<string | null>(null)
  const [payTarget, setPayTarget] = useState<PayTarget | null>(null)
  const [paying, setPaying] = useState(false)
  const [cashOpen, setCashOpen] = useState(() => readCashRegister().isOpen)

  const range = useMemo(() => rangeFor(period, customStart, customEnd), [period, customStart, customEnd])

  const load = useCallback(async (target: [Date, Date]) => {
    const [start, end] = [target[0].toISOString(), target[1].toISOString()]
    const [earnings, paid] = await Promise.all([fetchCourierEarnings(start, end), fetchCourierPayouts(start, end)])
    setData(earnings)
    setPayouts(paid)
  }, [])

  useEffect(() => {
    if (!range) return
    let active = true
    setLoading(true)
    void load(range)
      .catch(() => { if (active) toast.error('Não foi possível carregar o repasse dos entregadores.') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [range, load])

  // o botão "pagar com dinheiro do caixa" depende do caixa estar aberto
  useEffect(() => {
    const update = (event: Event) => setCashOpen(((event as CustomEvent<CashRegisterState>).detail ?? readCashRegister()).isOpen)
    window.addEventListener(cashRegisterUpdatedEvent, update)
    void fetchCashRegister().then((state) => setCashOpen(state.isOpen)).catch(() => undefined)
    return () => window.removeEventListener(cashRegisterUpdatedEvent, update)
  }, [])

  const markAsPaid = async (courierName: string, fromCash: boolean) => {
    if (!range) return
    setPaying(true)
    try {
      const payout = await createCourierPayout(courierName, range[0].toISOString(), range[1].toISOString(), fromCash)
      toast.success(`Pagamento de ${formatCurrency(payout.amount)} registrado${payout.fromCash ? ' e lançado como sangria no caixa' : ''}.`)
      setPayTarget(null)
      await load(range)
    } catch (error) {
      toast.error(payoutErrorMessage(error, 'Não foi possível registrar o pagamento. Atualize a tela e tente de novo.'))
    } finally {
      setPaying(false)
    }
  }

  const undoPayout = async (payout: CourierPayout) => {
    if (!range) return
    try {
      await undoCourierPayout(payout.id)
      toast.success('Pagamento desfeito. As entregas voltaram para "a pagar".')
      await load(range)
    } catch (error) {
      toast.error(payoutErrorMessage(error, 'Não foi possível desfazer o pagamento.'))
    }
  }

  const percent = data ? String(data.percent).replace('.', ',') : '80'
  const totals = data?.totals
  const cards = [
    { label: 'Entregas finalizadas', value: String(totals?.count ?? 0) },
    { label: `Repasse total (padrão ${percent}%)`, value: formatCurrency(totals?.pay ?? 0) },
    { label: 'Já pago', value: formatCurrency(totals?.paid ?? 0) },
    { label: 'A pagar', value: formatCurrency(totals?.pending ?? 0), highlight: true },
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
        <Button type="button" variant="outline" className="ml-auto h-9 rounded-full border-orange-200 px-4 text-sm" disabled={!data || !range || data.couriers.length === 0} onClick={() => data && range && downloadEarningsCsv(data, range)}>
          <Download className="mr-1.5 h-4 w-4" />Exportar planilha
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, highlight }) => (
          <div key={label} className={cn('rounded-[28px] border bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]', highlight ? 'border-orange-300' : 'border-orange-100')}>
            <p className="text-sm font-semibold text-slate-500">{label}</p>
            <p className={cn('mt-4 font-heading text-3xl font-bold', highlight ? 'text-orange-600' : 'text-slate-900')}>{loading && !data ? '…' : value}</p>
          </div>
        ))}
      </div>
      {totals ? <p className="-mt-3 text-sm text-slate-500">Taxas cobradas no período: {formatCurrency(totals.fees)} · fica com a loja: {formatCurrency(totals.store)}</p> : null}

      <section className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <h3 className="font-heading text-xl font-bold text-slate-900">Por entregador</h3>
        <p className="mt-1 text-sm text-slate-500">Conta só entregas finalizadas no período. O valor de cada entrega fica guardado na hora em que ela termina, então mudar a porcentagem depois não altera o histórico.</p>
        <div className="mt-4 space-y-3">
          {!range ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-center text-sm text-slate-500">Escolha uma data inicial e uma final.</p> : null}
          {range && !loading && data && data.couriers.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-center text-sm text-slate-500">Nenhuma entrega finalizada neste período.</p> : null}
          {data?.couriers.map((courier) => {
            const key = courier.name || '__none__'
            const expanded = open === key
            const settled = courier.pending <= 0
            return (
              <div key={key} className="rounded-2xl border border-orange-100">
                <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                  <button type="button" onClick={() => setOpen(expanded ? null : key)} aria-expanded={expanded} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                    <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition', expanded && 'rotate-180')} />
                    <span className="min-w-0">
                      <span className="block font-semibold text-slate-900">{courier.name || NO_COURIER}{courier.payPercent !== null ? <span className="ml-2 rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-700">{String(courier.payPercent).replace('.', ',')}%</span> : null}</span>
                      <span className="block text-sm text-slate-500">{courier.count} {courier.count === 1 ? 'entrega' : 'entregas'} · taxas {formatCurrency(courier.fees)} · repasse {formatCurrency(courier.pay)} · loja {formatCurrency(courier.store)}</span>
                    </span>
                  </button>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{settled ? 'Pago' : 'A pagar'}</p>
                      <p className={cn('font-mono text-lg font-bold', settled ? 'text-emerald-600' : 'text-orange-600')}>{formatCurrency(settled ? courier.paid : courier.pending)}</p>
                    </div>
                    {!settled ? (
                      <Button type="button" className="h-9 rounded-full px-4 text-sm" onClick={() => setPayTarget({ name: courier.name, pending: courier.pending, count: courier.deliveries.filter((delivery) => !delivery.paid).length })}>Marcar como pago</Button>
                    ) : null}
                  </div>
                </div>
                {expanded ? (
                  <div className="overflow-x-auto border-t border-orange-100">
                    <table className="w-full min-w-[480px] text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-slate-400">
                          <th className="px-4 py-2 font-semibold">Pedido</th>
                          <th className="px-4 py-2 font-semibold">Finalizada</th>
                          <th className="px-4 py-2 text-right font-semibold">Taxa</th>
                          <th className="px-4 py-2 text-right font-semibold">Repasse</th>
                          <th className="px-4 py-2 font-semibold">Situação</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courier.deliveries.map((delivery) => (
                          <tr key={delivery.orderId} className="border-t border-orange-50">
                            <td className="px-4 py-2 text-slate-700">#{delivery.orderId} · {delivery.customer}</td>
                            <td className="px-4 py-2 text-slate-500">{formatDateTime(delivery.finishedAt)}</td>
                            <td className="px-4 py-2 text-right font-mono text-slate-600">{formatCurrency(delivery.fee)}</td>
                            <td className="px-4 py-2 text-right font-mono font-semibold text-slate-900">{formatCurrency(delivery.pay)}</td>
                            <td className="px-4 py-2"><span className={cn('rounded-full px-2 py-0.5 text-xs font-semibold', delivery.paid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700')}>{delivery.paid ? 'Pago' : 'A pagar'}</span></td>
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

      <section className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <h3 className="font-heading text-xl font-bold text-slate-900">Pagamentos registrados</h3>
        <p className="mt-1 text-sm text-slate-500">Pagamentos que cobrem o período escolhido.</p>
        <div className="mt-4 space-y-3">
          {payouts.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-center text-sm text-slate-500">Nenhum pagamento registrado para este período.</p> : null}
          {payouts.map((payout) => (
            <div key={payout.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-100 p-3 text-sm">
              <div>
                <p className="font-semibold text-slate-900">{payout.courierName || NO_COURIER} · {formatCurrency(payout.amount)}</p>
                <p className="text-slate-500">{payout.count} {payout.count === 1 ? 'entrega' : 'entregas'} · pago em {formatDateLong(payout.paidAt)}{payout.paidBy ? ` por ${payout.paidBy}` : ''}{payout.fromCash ? ' · com dinheiro do caixa' : ''}</p>
              </div>
              <ConfirmDialog
                trigger={<button type="button" className="text-sm font-semibold text-slate-500 hover:text-slate-800">Desfazer</button>}
                title="Desfazer pagamento"
                description={`Desfazer o pagamento de ${formatCurrency(payout.amount)} a ${payout.courierName || 'o entregador'}? As ${payout.count} ${payout.count === 1 ? 'entrega volta' : 'entregas voltam'} para "a pagar".`}
                confirmLabel="Desfazer pagamento"
                onConfirm={() => void undoPayout(payout)}
              />
            </div>
          ))}
        </div>
      </section>
      <PayCourierDialog target={payTarget} cashOpen={cashOpen} busy={paying} onClose={() => setPayTarget(null)} onConfirm={(fromCash) => payTarget && void markAsPaid(payTarget.name, fromCash)} />
    </div>
  )
}
