import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import { MapPin, Navigation, Phone } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { fetchCourierJob, finishDelivery, sendCourierLocation, startDelivery, type CourierJob } from '@/lib/delivery-api'
import { formatCurrency } from '@/lib/formatters'
import { distanceBetween, fetchRoute, formatRouteSummary, geocodeAddress, type Point, type RouteInfo } from '@/lib/geo'

const CourierMap = lazy(() => import('@/components/delivery/courier-map').then((module) => ({ default: module.CourierMap })))

const SEND_INTERVAL_MS = 5_000
// o trajeto é recalculado quando o entregador anda um pouco ou depois de um tempo, para não sobrecarregar o serviço de rotas
const ROUTE_MIN_INTERVAL_MS = 15_000
const ROUTE_MAX_AGE_MS = 90_000
const ROUTE_MIN_MOVE_METERS = 100

type WakeLockSentinelLike = { release: () => Promise<void> }

function geolocationMessage(error: GeolocationPositionError) {
  if (error.code === error.PERMISSION_DENIED) return 'Permissão de localização negada. Ative a localização do navegador para este site.'
  if (error.code === error.POSITION_UNAVAILABLE) return 'Não foi possível obter sua localização. Verifique o GPS.'
  return 'Demorou para obter sua localização. Tente de novo.'
}

/** Tela do entregador: abre pelo link enviado pelo restaurante, sem login. Envia a posição enquanto a entrega está ativa. */
export function CourierPage() {
  const { token = '' } = useParams()
  const [job, setJob] = useState<CourierJob | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [tracking, setTracking] = useState(false)
  const [lastSentAt, setLastSentAt] = useState<Date | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [position, setPosition] = useState<Point | null>(null)
  const [destination, setDestination] = useState<Point | null>(null)
  const [route, setRoute] = useState<RouteInfo | null>(null)
  const lastRouted = useRef<{ point: Point; at: number } | null>(null)
  const watchId = useRef<number | null>(null)
  const lastSent = useRef(0)
  const wakeLock = useRef<WakeLockSentinelLike | null>(null)

  const stopWatching = useCallback(() => {
    if (watchId.current !== null) navigator.geolocation.clearWatch(watchId.current)
    watchId.current = null
    void wakeLock.current?.release().catch(() => undefined)
    wakeLock.current = null
    setTracking(false)
  }, [])

  const startWatching = useCallback(() => {
    if (!('geolocation' in navigator)) {
      setLocationError('Este aparelho não permite localização no navegador.')
      return
    }
    // mantém a tela acesa: com a tela apagada o navegador pausa o envio da posição
    const wakeLockApi = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock
    void wakeLockApi?.request('screen').then((lock) => { wakeLock.current = lock }).catch(() => undefined)

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        setLocationError(null)
        setPosition({ latitude: position.coords.latitude, longitude: position.coords.longitude })
        const now = Date.now()
        if (now - lastSent.current < SEND_INTERVAL_MS) return
        lastSent.current = now
        void sendCourierLocation(token, {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        }).then(() => setLastSentAt(new Date())).catch(() => setLocationError('Sem conexão para enviar a localização. Tentando de novo...'))
      },
      (geoError) => setLocationError(geolocationMessage(geoError)),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
    )
    setTracking(true)
  }, [token])

  useEffect(() => {
    let active = true
    void fetchCourierJob(token)
      .then((loaded) => {
        if (!active) return
        setJob(loaded)
        if (loaded.started && !loaded.finished) startWatching()
      })
      .catch(() => { if (active) setError('Link inválido ou expirado. Peça um novo link ao restaurante.') })
    return () => {
      active = false
      stopWatching()
    }
  }, [token, startWatching, stopWatching])

  const jobAddress = job?.address
  useEffect(() => {
    if (!jobAddress) return
    let active = true
    void geocodeAddress(jobAddress).then((point) => { if (active) setDestination(point) })
    return () => { active = false }
  }, [jobAddress])

  useEffect(() => {
    if (!position || !destination) return
    const last = lastRouted.current
    if (last) {
      const elapsed = Date.now() - last.at
      const moved = distanceBetween(last.point, position)
      if (elapsed < ROUTE_MIN_INTERVAL_MS || (moved < ROUTE_MIN_MOVE_METERS && elapsed < ROUTE_MAX_AGE_MS)) return
    }
    lastRouted.current = { point: position, at: Date.now() }
    void fetchRoute(position, destination).then((result) => { if (result) setRoute(result) })
  }, [position, destination])

  // o navegador libera o wake lock ao trocar de aba; pede de novo ao voltar
  useEffect(() => {
    if (!tracking) return
    const reacquire = () => {
      const wakeLockApi = (navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } }).wakeLock
      if (document.visibilityState === 'visible' && !wakeLock.current) {
        void wakeLockApi?.request('screen').then((lock) => { wakeLock.current = lock }).catch(() => undefined)
      }
    }
    document.addEventListener('visibilitychange', reacquire)
    return () => document.removeEventListener('visibilitychange', reacquire)
  }, [tracking])

  const handleStart = async () => {
    setBusy(true)
    try {
      await startDelivery(token)
      setJob((current) => current && { ...current, started: true })
      lastSent.current = 0
      startWatching()
    } catch {
      toast.error('Não foi possível iniciar a entrega. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  const handleFinish = async () => {
    if (!window.confirm('Confirmar que o pedido foi entregue?')) return
    setBusy(true)
    try {
      await finishDelivery(token)
      stopWatching()
      setJob((current) => current && { ...current, finished: true })
    } catch {
      toast.error('Não foi possível finalizar a entrega. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }

  if (error) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fff8f1] p-6 text-center text-slate-700"><p className="max-w-sm">{error}</p></main>
  }
  if (!job) {
    return <main className="flex min-h-screen items-center justify-center bg-[#fff8f1] p-6 text-slate-500">Carregando entrega...</main>
  }

  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(job.address.split(' - Ref:')[0])}`
  const stage = job.finished ? 'Entregue' : job.started ? 'Em rota' : 'Aguardando início'

  return (
    <main className="min-h-screen bg-[#fff8f1] pb-40 text-slate-900">
      <header className="rounded-b-[36px] bg-gradient-to-br from-orange-400 via-orange-500 to-orange-700 px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))] text-white shadow-[0_18px_40px_rgba(0,0,0,0.12)]">
        <div className="mx-auto flex max-w-md items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-white/80">Entrega</p>
            <h1 className="font-heading text-4xl font-black">Pedido #{job.orderId}</h1>
          </div>
          <span className="mt-1 inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1.5 text-xs font-bold backdrop-blur"><span className={`h-2 w-2 rounded-full ${job.finished ? 'bg-emerald-300' : job.started ? 'animate-pulse bg-white' : 'bg-white/60'}`} />{stage}</span>
        </div>
      </header>

      <div className="mx-auto -mt-10 max-w-md space-y-4 px-4">
        <div className="space-y-3 rounded-[28px] border border-orange-100 bg-white p-5 text-sm shadow-[0_14px_36px_rgba(15,23,42,0.08)]">
          <p className="font-heading text-xl font-bold">{job.customer}</p>
          <p className="flex gap-2 text-slate-600"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />{job.address}</p>
          <div className="grid grid-cols-2 gap-2">
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border border-orange-200 px-4 py-2.5 font-semibold text-orange-700"><Navigation className="h-4 w-4" />Abrir rota</a>
            <a href={`tel:${job.phone.replace(/[^\d+]/g, '')}`} className="inline-flex items-center justify-center gap-2 rounded-full border border-orange-200 px-4 py-2.5 font-semibold text-orange-700"><Phone className="h-4 w-4" />Ligar</a>
          </div>
        </div>

        {!job.finished && (destination || position) ? (
          <div className="space-y-2">
            <Suspense fallback={<div className="h-64 animate-pulse rounded-[28px] bg-orange-50" />}>
              <CourierMap courier={position} destination={destination} destinationLabel="Destino" route={route?.coordinates ?? null} className="h-64 overflow-hidden rounded-[28px]" />
            </Suspense>
            {route ? <p className="text-center text-sm font-semibold text-slate-700">{formatRouteSummary(route)}</p> : null}
            <p className="text-center text-xs text-slate-400">O ponto do destino é aproximado. Para navegar curva a curva, use Abrir rota.</p>
          </div>
        ) : null}

        <div className="space-y-2 rounded-[28px] border border-orange-100 bg-white p-5 text-sm shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Itens</p>
          <ul className="space-y-1 text-slate-700">{job.items.map((item) => <li key={item}>• {item}</li>)}</ul>
          {job.notes ? <p className="rounded-2xl bg-amber-50 p-3 text-amber-800">{job.notes}</p> : null}
          <p className="flex items-center justify-between border-t border-orange-100 pt-3 font-semibold"><span>{job.payment}</span><span className="font-mono text-lg">{formatCurrency(job.value)}</span></p>
        </div>

        {!job.finished && job.started ? (
          <p className={`rounded-[24px] border p-4 text-center text-sm font-semibold ${locationError ? 'border-amber-200 bg-amber-50 text-amber-800' : 'border-sky-200 bg-sky-50 text-sky-800'}`}>
            {locationError ?? (lastSentAt ? `Localização enviada às ${lastSentAt.toLocaleTimeString('pt-BR')}` : 'Obtendo sua localização...')}
          </p>
        ) : null}
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white/95 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto max-w-md space-y-2">
          {job.finished ? (
            <p className="rounded-full border border-emerald-200 bg-emerald-50 p-4 text-center font-semibold text-emerald-800">Entrega finalizada. Obrigado!</p>
          ) : !job.started ? (
            <>
              <Button className="h-14 w-full rounded-full text-base" onClick={handleStart} disabled={busy}>Iniciar entrega</Button>
              <p className="text-center text-xs text-slate-500">Ao iniciar, o cliente vê sua localização até você finalizar. O navegador vai pedir permissão de localização.</p>
            </>
          ) : (
            <>
              {locationError && !tracking ? <Button variant="outline" className="w-full rounded-full" onClick={startWatching}>Tentar novamente</Button> : <p className="text-center text-xs text-slate-500">Mantenha esta tela aberta e com a tela ligada para o cliente acompanhar.</p>}
              <Button className="h-14 w-full rounded-full text-base" onClick={handleFinish} disabled={busy}>Entreguei o pedido</Button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
