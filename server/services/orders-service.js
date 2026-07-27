import { listOrders, replaceOrders } from '../repositories/orders-repository.js'
import { notifyOrderStatusUpdate } from './order-status-notifier.js'

export async function getOrders() {
  return listOrders()
}

export async function updateOrders(nextOrders) {
  const { orders, changedOrders } = await replaceOrders(nextOrders)
  const notificationResults = await Promise.allSettled(changedOrders.map((order) => notifyOrderStatusUpdate(order)))

  return {
    orders,
    notifications: {
      changed: changedOrders.length,
      failed: notificationResults.some((result) => result.status === 'rejected'),
    },
  }
}
