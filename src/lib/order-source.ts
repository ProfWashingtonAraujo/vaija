import { Globe, ShoppingBag, UtensilsCrossed, type LucideIcon } from 'lucide-react'

export type OrderSource = 'Mesa' | 'Online' | 'Retirada'

export const orderSources: OrderSource[] = ['Mesa', 'Online', 'Retirada']

export const orderSourceIcons: Record<OrderSource, LucideIcon> = {
  Mesa: UtensilsCrossed,
  Online: Globe,
  Retirada: ShoppingBag,
}

/** Pedidos antigos não têm tipo: contam como Online. */
export function resolveOrderSource(source?: string): OrderSource {
  return source === 'Mesa' || source === 'Retirada' ? source : 'Online'
}

/** Só o pedido Online tem taxa de entrega e endereço. */
export function defaultDeliveryFee(source?: string) {
  return resolveOrderSource(source) === 'Online' ? 8 : 0
}

export function orderSourceLabel(source?: string, tableNumber?: string) {
  const resolved = resolveOrderSource(source)
  return resolved === 'Mesa' ? `Mesa ${tableNumber ?? '--'}` : resolved
}
