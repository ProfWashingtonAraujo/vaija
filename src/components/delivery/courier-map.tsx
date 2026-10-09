import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

type Point = { latitude: number; longitude: number }

const courierStyle = { radius: 10, color: '#ffffff', weight: 3, fillColor: '#ff6b00', fillOpacity: 1 }
const destinationStyle = { radius: 9, color: '#ffffff', weight: 3, fillColor: '#0f172a', fillOpacity: 1 }

/** Mapa do acompanhamento: ponto laranja é o entregador, ponto escuro é o endereço de entrega. */
export function CourierMap({ courier, destination }: { courier: Point; destination: Point | null }) {
  const container = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const courierMarker = useRef<L.CircleMarker | null>(null)
  const destinationMarker = useRef<L.CircleMarker | null>(null)
  const fitted = useRef(false)

  useEffect(() => {
    if (!container.current) return
    const instance = L.map(container.current, { zoomControl: true, attributionControl: true }).setView([courier.latitude, courier.longitude], 15)
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
      fitted.current = false
    }
    // o mapa é criado uma vez; as posições são atualizadas no efeito abaixo
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const instance = map.current
    if (!instance) return
    const courierLatLng = L.latLng(courier.latitude, courier.longitude)
    if (courierMarker.current) courierMarker.current.setLatLng(courierLatLng)
    else courierMarker.current = L.circleMarker(courierLatLng, courierStyle).addTo(instance).bindTooltip('Entregador')

    if (destination) {
      const destinationLatLng = L.latLng(destination.latitude, destination.longitude)
      if (destinationMarker.current) destinationMarker.current.setLatLng(destinationLatLng)
      else destinationMarker.current = L.circleMarker(destinationLatLng, destinationStyle).addTo(instance).bindTooltip('Seu endereço')
    }

    // enquadra os dois pontos uma vez; depois respeita o zoom/arraste do cliente
    if (!fitted.current) {
      fitted.current = true
      if (destination) instance.fitBounds(L.latLngBounds([courierLatLng, L.latLng(destination.latitude, destination.longitude)]), { padding: [40, 40], maxZoom: 17 })
      else instance.setView(courierLatLng, 16)
    }
  }, [courier.latitude, courier.longitude, destination])

  return <div ref={container} className="h-72 w-full overflow-hidden rounded-[24px] border border-orange-100 sm:h-96" />
}
