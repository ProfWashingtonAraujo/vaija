export type Point = { latitude: number; longitude: number }

export type RouteInfo = {
  /** Pontos do trajeto no formato [latitude, longitude], como o Leaflet espera. */
  coordinates: Array<[number, number]>
  distanceMeters: number
  durationSeconds: number
}

const geocodeCache = new Map<string, Point | null>()

/** Endereço do pedido -> coordenadas (aproximadas), só para marcar o destino no mapa. */
export async function geocodeAddress(address: string): Promise<Point | null> {
  const query = address.split(' - Ref:')[0].trim()
  if (!query) return null
  if (geocodeCache.has(query)) return geocodeCache.get(query) ?? null
  try {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(`${query}, Brasil`)}`)
    const results = response.ok ? await response.json() as Array<{ lat: string; lon: string }> : []
    const point = results[0] ? { latitude: Number(results[0].lat), longitude: Number(results[0].lon) } : null
    geocodeCache.set(query, point)
    return point
  } catch {
    return null
  }
}

/** Distância em linha reta, em metros (fórmula de haversine). */
export function distanceBetween(a: Point, b: Point) {
  const toRad = (degrees: number) => (degrees * Math.PI) / 180
  const dLat = toRad(b.latitude - a.latitude)
  const dLon = toRad(b.longitude - a.longitude)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2
  return 2 * 6_371_000 * Math.asin(Math.sqrt(h))
}

/** Trajeto de carro entre dois pontos (OSRM, dados do OpenStreetMap). Devolve null se o serviço falhar. */
export async function fetchRoute(from: Point, to: Point): Promise<RouteInfo | null> {
  try {
    const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${from.longitude},${from.latitude};${to.longitude},${to.latitude}?overview=full&geometries=geojson`)
    if (!response.ok) return null
    const data = await response.json() as { routes?: Array<{ distance: number; duration: number; geometry: { coordinates: Array<[number, number]> } }> }
    const route = data.routes?.[0]
    if (!route) return null
    return {
      coordinates: route.geometry.coordinates.map(([longitude, latitude]) => [latitude, longitude]),
      distanceMeters: route.distance,
      durationSeconds: route.duration,
    }
  } catch {
    return null
  }
}

export function formatRouteSummary(route: RouteInfo) {
  const km = route.distanceMeters / 1000
  const distance = km < 1 ? `${Math.round(route.distanceMeters / 10) * 10} m` : `${km.toFixed(1).replace('.', ',')} km`
  const minutes = Math.max(1, Math.round(route.durationSeconds / 60))
  return `${distance} · cerca de ${minutes} min`
}
