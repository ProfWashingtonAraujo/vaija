import type { Order } from '@/data/mock-orders'

const webhookUrl = import.meta.env.VITE_N8N_ORDER_STATUS_WEBHOOK_URL

function normalizePhone(phone: string) {
  return phone.replace(/\D/g, '')
}

export async function notifyOrderStatusUpdate(order: Order) {
  if (!webhookUrl) {
    return
  }

  await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      orderId: order.id,
      customer: order.customer,
      phone: normalizePhone(order.phone),
      rawPhone: order.phone,
      status: order.status,
      items: order.items,
      value: order.value,
      payment: order.payment,
      time: order.time,
      elapsed: order.elapsed,
    }),
  })
}
