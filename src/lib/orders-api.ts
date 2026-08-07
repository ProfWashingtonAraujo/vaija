import { orders as mockOrders, type Order } from '@/data/mock-orders'
import { readTenantStorage, writeTenantStorage, getTenantId } from '@/lib/tenant-storage'

const localOrdersKey = 'vaija.orders'

function getTenantHeaders(): HeadersInit {
  const tenantId = getTenantId()
  return { 'X-Tenant-Id': tenantId }
}

const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

export async function fetchOrders(): Promise<Order[]> {
  try {
    if (API_BASE) {
      const response = await fetch(`${API_BASE}/api/orders`, {
        headers: getTenantHeaders(),
        credentials: 'include',
      })
      if (response.ok) {
        const data = await response.json()
        return data.orders || []
      }
    }
  } catch {
    // Fallback to localStorage
  }
  return readTenantStorage(localOrdersKey, mockOrders)
}

export async function saveOrders(orders: Order[]): Promise<Order[]> {
  try {
    if (API_BASE) {
      const response = await fetch(`${API_BASE}/api/orders`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
        credentials: 'include',
        body: JSON.stringify({ orders }),
      })
      if (response.ok) {
        return orders
      }
    }
  } catch {
    // Fallback to localStorage
  }
  writeTenantStorage(localOrdersKey, orders)
  return orders
}
