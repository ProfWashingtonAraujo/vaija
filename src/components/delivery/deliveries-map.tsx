import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

export type MapCourier = { orderId: number; label: string; latitude: number; longitude: number; stale: boolean }

const freshStyle = { radius: 10, color: '#ffffff', weight: 3, fillColor: '#ff6b00', fillOpacity: 1 }
const staleStyle = { radius: 10, color: '#ffffff', weight: 3, fillColor: '#d97706', fillOpacity: 0.85 }

/** Mapa do gerente: um ponto por entregador em rota. Ponto âmbar = sem sinal há mais de 1 minuto. */
export function DeliveriesMap({ couriers }: { couriers: MapCourier[] }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const markers = useRef(new Map<number, L.CircleMarker>())
  const fittedFor = useRef('')

  useEffect(() => {
    if (!container.current) return
    const instance = L.map(container.current).setView([-14.235, -51.925], 4)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance)
    map.current = instance
    const currentMarkers = markers.current
    return () => {
      instance.remove()
      map.current = null
      currentMarkers.clear()
      fittedFor.current = ''
    }
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const seen = new Set<number>()

    couriers.forEach((courier) => {
      seen.add(courier.orderId)
      const latLng = L.latLng(courier.latitude, courier.longitude)
      const style = courier.stale ? staleStyle : freshStyle
      const existing = markers.current.get(courier.orderId)
      if (existing) {
        existing.setLatLng(latLng).setStyle(style).setTooltipContent(courier.label)
      } else {
        const marker = L.circleMarker(latLng, style).addTo(instance).bindTooltip(courier.label, { permanent: true, direction: 'top', offset: [0, -8] })
        markers.current.set(courier.orderId, marker)
      }
    })
    markers.current.forEach((marker, orderId) => {
      if (!seen.has(orderId)) {
        marker.remove()
        markers.current.delete(orderId)
      }
    })

    // enquadra todos quando o conjunto de entregas muda; depois respeita o zoom/arraste do gerente
    const key = couriers.map((courier) => courier.orderId).sort((a, b) => a - b).join(',')
    if (key && key !== fittedFor.current) {
      fittedFor.current = key
      const bounds = L.latLngBounds(couriers.map((courier) => L.latLng(courier.latitude, courier.longitude)))
      instance.fitBounds(bounds, { padding: [50, 50], maxZoom: 16 })
    }
  }, [couriers])

  return <div ref={container} className="h-80 w-full overflow-hidden rounded-[24px] border border-orange-100 sm:h-[26rem]" />
}
