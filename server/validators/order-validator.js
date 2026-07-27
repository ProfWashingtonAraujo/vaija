import { allowedOrderStatuses } from '../lib/env.js'

export function isValidOrder(order) {
  return order
    && typeof order.id === 'number'
    && typeof order.customer === 'string'
    && typeof order.phone === 'string'
    && typeof order.address === 'string'
    && Array.isArray(order.items)
    && typeof order.elapsed === 'string'
    && typeof order.value === 'number'
    && typeof order.time === 'string'
    && typeof order.payment === 'string'
    && allowedOrderStatuses.has(order.status)
}

export function isValidOrdersPayload(payload) {
  return Array.isArray(payload?.orders) && payload.orders.every(isValidOrder)
}
