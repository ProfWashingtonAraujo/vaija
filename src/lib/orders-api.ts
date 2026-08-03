import { orders as mockOrders, type Order } from '@/data/mock-orders'
import { readTenantStorage, writeTenantStorage } from '@/lib/tenant-storage'

const localOrdersKey = 'vaija.orders'

export async function fetchOrders() {
  return readTenantStorage(localOrdersKey, mockOrders)
}

export async function saveOrders(orders: Order[]) {
  writeTenantStorage(localOrdersKey, orders)
  return orders
}
