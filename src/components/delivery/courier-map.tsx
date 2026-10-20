import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Point } from '@/lib/geo'

const courierStyle = { radius: 10, color: '#ffffff', weight: 3, fillColor: '#ff6b00', fillOpacity: 1 }
const destinationStyle = { radius: 9, color: '#ffffff', weight: 3, fillColor: '#0f172a', fillOpacity: 1 }
const routeStyle = { color: '#ff6b00', weight: 5, opacity: 0.75 }

type CourierMapProps = {
  courier: Point | null
  destination: Point | null
  destinationLabel?: string
  /** Trajeto a desenhar, no formato [latitude, longitude]. */
  route?: Array<[number, number]> | null
  className?: string
}

/** Mapa de entrega: ponto laranja é o entregador, ponto escuro é o endereço de entrega. */
export function CourierMap({ courier, destination, destinationLabel = 'Seu endereço', route = null, className = 'h-72 sm:h-96' }: CourierMapProps) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const courierMarker = useRef<L.CircleMarker | null>(null)
  const destinationMarker = useRef<L.CircleMarker | null>(null)
  const routeLine = useRef<L.Polyline | null>(null)
  const fitted = useRef(false)
  const fittedBoth = useRef(false)

  useEffect(() => {
    if (!container.current) return
    const start = courier ?? destination
    const instance = L.map(container.current, { zoomControl: true, attributionControl: true }).setView(start ? [start.latitude, start.longitude] : [-14.2, -51.9], start ? 15 : 4)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(instance)
    map.current = instance
    return () => {
      instance.remove()
      map.current = null
      courierMarker.current = null
      destinationMarker.current = null
      routeLine.current = null
      fitted.current = false
      fittedBoth.current = false
    }
    // o mapa é criado uma vez; as posições são atualizadas no efeito abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const courierLatLng = courier ? L.latLng(courier.latitude, courier.longitude) : null
    const destinationLatLng = destination ? L.latLng(destination.latitude, destination.longitude) : null

    if (courierLatLng) {
      if (courierMarker.current) courierMarker.current.setLatLng(courierLatLng)
      else courierMarker.current = L.circleMarker(courierLatLng, courierStyle).addTo(instance).bindTooltip('Entregador')
    }
    if (destinationLatLng) {
      if (destinationMarker.current) destinationMarker.current.setLatLng(destinationLatLng)
      else destinationMarker.current = L.circleMarker(destinationLatLng, destinationStyle).addTo(instance).bindTooltip(destinationLabel)
    }

    // enquadra os pontos na primeira vez (e de novo quando o segundo ponto aparece); depois respeita o zoom/arraste
    if (courierLatLng && destinationLatLng) {
      if (!fittedBoth.current) {
        fittedBoth.current = true
        fitted.current = true
        instance.fitBounds(L.latLngBounds([courierLatLng, destinationLatLng]), { padding: [40, 40], maxZoom: 17 })
      }
    } else if (!fitted.current) {
      const only = courierLatLng ?? destinationLatLng
      if (only) {
        fitted.current = true
        instance.setView(only, 16)
      }
    }
  }, [courier, destination, destinationLabel])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    if (!route || route.length < 2) {
      routeLine.current?.remove()
      routeLine.current = null
      return
    }
    if (routeLine.current) routeLine.current.setLatLngs(route)
    else routeLine.current = L.polyline(route, routeStyle).addTo(instance)
    // o trajeto fica sob os pontos
    routeLine.current.bringToBack()
  }, [route])

  return <div ref={container} className={`${className} w-full overflow-hidden rounded-[24px] border border-orange-100`} />
}
