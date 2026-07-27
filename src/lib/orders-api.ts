import type { Order } from '@/data/mock-orders'
import { apiFetch } from '@/lib/api-client'

export async function fetchOrders() {
  const response = await apiFetch('/api/orders')

  if (!response.ok) {
    throw new Error('failed_to_fetch_orders')
  }

  const data = await response.json() as { orders: Order[] }
  return data.orders
}

export async function saveOrders(orders: Order[]) {
  const response = await apiFetch('/api/orders', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ orders }),
  })

  if (!response.ok) {
    throw new Error('failed_to_save_orders')
  }

  const data = await response.json() as { orders: Order[] }
  return data.orders
}
