export function getPublicOrderUrl(tenantId: string) {
  return new URL(`/pedido/${encodeURIComponent(tenantId)}`, window.location.origin).toString()
}

export function getPublicOrderTrackingUrl(tenantId: string, orderId: number) {
  const url = new URL(`${getPublicOrderUrl(tenantId)}/acompanhar`)
  url.searchParams.set('pedido', String(orderId))
  return url.toString()
}
