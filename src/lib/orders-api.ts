import { orders as mockOrders, type Order } from '@/data/mock-orders'
import { readTenantStorage, writeTenantStorage, getTenantId } from '@/lib/tenant-storage'
import { apiFetch } from '@/lib/api-client'

const localOrdersKey = 'vaija.orders'

function getTenantHeaders(): HeadersInit {
  const tenantId = getTenantId()
  return { 'X-Tenant-Id': tenantId }
}

export async function fetchOrders(): Promise<Order[]> {
  if (import.meta.env.VITE_OFFLINE_MODE === 'true') return readTenantStorage(localOrdersKey, mockOrders)
  const response = await apiFetch('/api/orders', { headers: getTenantHeaders() })
  if (!response.ok) throw new Error(`failed_to_fetch_orders:${response.status}`)
  const data = await response.json()
  return data.orders || []
}

export async function saveOrders(orders: Order[]): Promise<Order[]> {
  if (import.meta.env.VITE_OFFLINE_MODE === 'true') {
    writeTenantStorage(localOrdersKey, orders)
    return orders
  }
  const response = await apiFetch('/api/orders', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
    body: JSON.stringify({ orders }),
  })
  if (!response.ok) throw new Error(`failed_to_save_orders:${response.status}`)
  return orders
}

export async function createOrder(order: Omit<Order, 'id'>): Promise<Order> {
  if (import.meta.env.VITE_OFFLINE_MODE === 'true') {
    const orders = readTenantStorage(localOrdersKey, mockOrders)
    const created = { ...order, id: Math.max(0, ...orders.map((item) => item.id)) + 1 }
    writeTenantStorage(localOrdersKey, [created, ...orders])
    return created
  }
  const response = await apiFetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
    body: JSON.stringify(order),
  })
  if (!response.ok) throw new Error(`failed_to_create_order:${response.status}`)
  const data = await response.json()
  return data.order
}

export async function createPublicOrder(order: Omit<Order, 'id'>, tenantId = 'default'): Promise<Order> {
  const response = await apiFetch(`/api/public/${encodeURIComponent(tenantId)}/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(order),
  }, false)
  if (!response.ok) throw new Error(`failed_to_create_public_order:${response.status}`)
  const data = await response.json()
  return data.order
}

export async function findPublicOrders(query: string, tenantId = 'default'): Promise<Order[]> {
  const path = `/api/public/${encodeURIComponent(tenantId)}/orders?query=${encodeURIComponent(query)}`
  const response = await apiFetch(path, undefined, false)
  if (!response.ok) throw new Error(`failed_to_find_public_orders:${response.status}`)
  const data = await response.json()
  return data.orders || []
}
