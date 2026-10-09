import { lazy, Suspense, useEffect, useState } from 'react'
import { Truck } from 'lucide-react'
import { fetchPublicCourierLocation, type CourierLocation } from '@/lib/delivery-api'
import { usePolling } from '@/lib/use-polling'

const CourierMap = lazy(() => import('@/components/delivery/courier-map').then((module) => ({ default: module.CourierMap })))

type Point = { latitude: number; longitude: number }

const destinationCache = new Map<string, Point | null>()

/** Endereço do pedido -> coordenadas (aproximadas), só para marcar o destino no mapa. */
async function geocodeDestination(address: string): Promise<Point | null> {
  const query = address.split(' - Ref:')[0].trim()
  if (!query) return null
  if (destinationCache.has(query)) return destinationCache.get(query) ?? null
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${query}, Brasil`)}`)
    const results = response.ok ? await response.json() as Array<{ lat: string; lon: string }> : []
    const point = results[0] ? { latitude: Number(results[0].lat), longitude: Number(results[0].lon) } : null
    destinationCache.set(query, point)
    return point
  } catch {
    return null
  }
}

function secondsAgo(iso?: string | null) {
  if (!iso) return null
  return Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000))
}

/** Mapa ao vivo do entregador, exibido enquanto o pedido está "Saiu para entrega". */
export function CourierTracking({ tenantId, orderId, address }: { tenantId: string; orderId: number; address: string }) {
  const [location, setLocation] = useState<CourierLocation | null>(null)
  const [destination, setDestination] = useState<Point | null>(null)
  const [, setTick] = useState(0)

  const refresh = () => fetchPublicCourierLocation(tenantId, orderId).then(setLocation).catch(() => undefined)

  useEffect(() => {
    void refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, orderId])

  useEffect(() => {
    let active = true
    void geocodeDestination(address).then((point) => { if (active) setDestination(point) })
    return () => { active = false }
  }, [address])

  usePolling(refresh, 5_000)

  // atualiza o "há X segundos" sem esperar a próxima consulta
  useEffect(() => {
    const timer = window.setInterval(() => setTick((value) => value + 1), 1_000)
    return () => window.clearInterval(timer)
  }, [])

  if (!location?.active || location.latitude === undefined || location.longitude === undefined) {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-[24px] border border-sky-100 bg-sky-50/60 p-4 text-sm text-sky-800">
        <Truck className="h-5 w-5 shrink-0" />Seu pedido saiu para entrega. Assim que o entregador compartilhar a localização, ela aparece aqui no mapa.
      </div>
    )
  }

  const age = secondsAgo(location.updatedAt)
  return (
    <div className="mt-6">
      <div className="mb-2 flex items-center justify-between gap-3 text-sm">
        <p className="font-semibold text-slate-900">Acompanhe o entregador</p>
        {age !== null ? <p className={age > 60 ? 'text-amber-600' : 'text-slate-500'}>{age > 60 ? 'Sinal fraco · ' : ''}atualizado há {age < 60 ? `${age} s` : `${Math.round(age / 60)} min`}</p> : null}
      </div>
      <Suspense fallback={<div className="h-72 animate-pulse rounded-[24px] bg-orange-50 sm:h-96" />}>
        <CourierMap courier={{ latitude: location.latitude, longitude: location.longitude }} destination={destination} />
      </Suspense>
      <p className="mt-2 text-xs text-slate-400">O ponto do endereço é aproximado.</p>
    </div>
  )
}
