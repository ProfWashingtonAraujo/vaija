import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Clock, Truck, Timer } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { fetchDeliveries, type DeliveryEntry } from '@/lib/delivery-api'
import { formatCurrency } from '@/lib/formatters'
import { usePolling } from '@/lib/use-polling'
import type { MapCourier } from '@/components/delivery/deliveries-map'

const DeliveriesMap = lazy(() => import('@/components/delivery/deliveries-map').then((module) => ({ default: module.DeliveriesMap })))

const STALE_AFTER_SECONDS = 60

function startOfTodayIso() {
  const now = new Date()
  return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
}

function secondsSince(iso: string | null | undefined, now: number) {
  return iso ? Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000)) : null
}

function formatDuration(totalSeconds: number | null) {
  if (totalSeconds === null) return '—'
  const minutes = Math.floor(totalSeconds / 60)
  if (minutes < 1) return `${totalSeconds} s`
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')} min`
}

function formatTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '—'
}

export function DeliveriesPage() {
  const [deliveries, setDeliveries] = useState<DeliveryEntry[]>([])
  const [loaded, setLoaded] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [courierFilter, setCourierFilter] = useState('')

  const load = () => fetchDeliveries(startOfTodayIso()).then((result) => {
    setDeliveries(result.deliveries)
    setNow(Date.now())
  })

  useEffect(() => {
    void load()
      .catch(() => toast.error('Não foi possível carregar as entregas.'))
      .finally(() => setLoaded(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  usePolling(() => load().catch(() => undefined), 5_000)

  // mantém os "há X s" andando entre uma consulta e outra
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  const couriers = useMemo(() => Array.from(new Set(deliveries.map((item) => item.courierName).filter((name): name is string => Boolean(name)))).sort(), [deliveries])
  const visible = deliveries.filter((item) => !courierFilter || item.courierName === courierFilter)
  const active = visible.filter((item) => item.state === 'active')
  const waiting = visible.filter((item) => item.state === 'waiting')
  const finished = visible.filter((item) => item.state === 'finished').sort((a, b) => (b.finishedAt ?? '').localeCompare(a.finishedAt ?? ''))

  const durations = finished
    .map((item) => (item.startedAt && item.finishedAt ? (new Date(item.finishedAt).getTime() - new Date(item.startedAt).getTime()) / 1000 : null))
    .filter((value): value is number => value !== null && value >= 0)
  const averageSeconds = durations.length > 0 ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : null

  const mapCouriers: MapCourier[] = active
    .filter((item) => item.location)
    .map((item) => ({
      orderId: item.orderId,
      label: `#${item.orderId}${item.courierName ? ` · ${item.courierName}` : ''}`,
      latitude: item.location!.latitude,
      longitude: item.location!.longitude,
      stale: (secondsSince(item.location!.updatedAt, now) ?? 0) > STALE_AFTER_SECONDS,
    }))

  const cards = [
    { label: 'Em rota', value: String(active.length), icon: Truck },
    { label: 'Aguardando início', value: String(waiting.length), icon: Clock },
    { label: 'Entregues hoje', value: String(finished.length), icon: CheckCircle2 },
    { label: 'Tempo médio', value: formatDuration(averageSeconds), icon: Timer },
  ]

  return (
    <AdminLayout title="Entregas" description="Acompanhe os entregadores em rota e o histórico de hoje.">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {cards.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><Icon className="h-5 w-5" /></div>
            </div>
            <p className="mt-4 font-heading text-3xl font-bold text-slate-900">{value}</p>
          </div>
        ))}
      </div>

      {couriers.length > 0 ? (
        <div className="mt-6 flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-slate-500">Entregador:</span>
          {['', ...couriers].map((name) => (
            <button key={name || 'todos'} type="button" onClick={() => setCourierFilter(name)} className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${courierFilter === name ? 'border-orange-500 bg-orange-500 text-white' : 'border-orange-100 bg-white text-slate-600 hover:border-orange-300'}`}>
              {name || 'Todos'}
            </button>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <h3 className="font-heading text-xl font-bold text-slate-900">Mapa ao vivo</h3>
          <div className="mt-4">
            {mapCouriers.length === 0 ? (
              <div className="flex h-80 items-center justify-center rounded-[24px] border border-dashed border-orange-200 bg-orange-50/50 p-6 text-center text-sm text-slate-500 sm:h-[26rem]">
                {loaded ? 'Nenhum entregador compartilhando a localização agora.' : 'Carregando...'}
              </div>
            ) : (
              <Suspense fallback={<div className="h-80 animate-pulse rounded-[24px] bg-orange-50 sm:h-[26rem]" />}>
                <DeliveriesMap couriers={mapCouriers} />
              </Suspense>
            )}
          </div>
          <p className="mt-3 text-xs text-slate-400">Ponto laranja: sinal recente. Ponto âmbar: sem sinal há mais de 1 minuto (tela bloqueada ou sem internet).</p>
        </section>

        <section className="space-y-6">
          <div className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <h3 className="font-heading text-xl font-bold text-slate-900">Em andamento</h3>
            <div className="mt-4 space-y-3">
              {active.length === 0 && waiting.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-center text-sm text-slate-500">Nenhuma entrega em andamento.</p> : null}
              {active.map((item) => {
                const signal = secondsSince(item.location?.updatedAt, now)
                const stale = signal === null || signal > STALE_AFTER_SECONDS
                return (
                  <div key={item.orderId} className="rounded-2xl border border-orange-100 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-slate-900">#{item.orderId} · {item.customer}</p>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${stale ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>{signal === null ? 'sem sinal' : `sinal há ${formatDuration(signal)}`}</span>
                    </div>
                    <p className="mt-1 text-slate-500">{item.address}</p>
                    <p className="mt-1 text-slate-500">{item.courierName ? `${item.courierName} · ` : ''}saiu às {formatTime(item.startedAt)} · há {formatDuration(secondsSince(item.startedAt, now))}</p>
                  </div>
                )
              })}
              {waiting.map((item) => (
                <div key={item.orderId} className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/40 p-3 text-sm">
                  <p className="font-semibold text-slate-900">#{item.orderId} · {item.customer}</p>
                  <p className="mt-1 text-slate-500">{item.courierName ? `${item.courierName} ` : 'Entregador '}ainda não iniciou · link gerado às {formatTime(item.createdAt)}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <h3 className="font-heading text-xl font-bold text-slate-900">Entregues hoje</h3>
            <div className="mt-4 space-y-3">
              {finished.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-center text-sm text-slate-500">Nenhuma entrega finalizada hoje.</p> : null}
              {finished.map((item) => (
                <div key={item.orderId} className="flex items-start justify-between gap-3 rounded-2xl border border-orange-100 p-3 text-sm">
                  <div>
                    <p className="font-semibold text-slate-900">#{item.orderId} · {item.customer}</p>
                    <p className="mt-1 text-slate-500">{item.courierName ? `${item.courierName} · ` : ''}{formatTime(item.startedAt)} → {formatTime(item.finishedAt)}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{formatDuration(item.startedAt && item.finishedAt ? Math.round((new Date(item.finishedAt).getTime() - new Date(item.startedAt).getTime()) / 1000) : null)}</p>
                    <p className="font-mono text-xs text-slate-500">{formatCurrency(item.value)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  )
}
