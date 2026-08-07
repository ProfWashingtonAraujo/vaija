import { listOrders, replaceOrders } from '../repositories/orders-repository.js'
import { notifyOrderStatusUpdate } from './order-status-notifier.js'

export async function getOrders(tenantId = 'default') {
  return listOrders(tenantId)
}

export async function updateOrders(nextOrders, tenantId = 'default') {
  const { orders, changedOrders } = await replaceOrders(nextOrders, tenantId)
  const notificationResults = await Promise.allSettled(changedOrders.map((order) => notifyOrderStatusUpdate(order)))

  return {
    orders,
    notifications: {
      changed: changedOrders.length,
      failed: notificationResults.some((result) => result.status === 'rejected'),
    },
  }
}
