import { Router } from 'express'
import { getOrders, updateOrders } from '../services/orders-service.js'
import { isValidOrdersPayload } from '../validators/order-validator.js'
import { emitNewOrder, emitOrderStatusChanged } from '../lib/websocket.js'
import { addPrintJob } from '../lib/queue.js'

export const ordersRouter = Router()

ordersRouter.get('/orders', async (request, response) => {
  const tenantId = request.auth?.tenantId || 'default'
  const orders = await getOrders(tenantId)
  response.json({ orders })
})

ordersRouter.put('/orders', async (request, response) => {
  if (!isValidOrdersPayload(request.body)) {
    response.status(400).json({ ok: false, error: 'invalid_orders_payload' })
    return
  }

  const tenantId = request.auth?.tenantId || 'default'
  const previousOrders = await getOrders(tenantId)
  const previousMap = new Map(previousOrders.map((o) => [o.id, o]))

  const result = await updateOrders(request.body.orders, tenantId)

  const currentOrders = await getOrders(tenantId)
  for (const order of currentOrders) {
    const prev = previousMap.get(order.id)

    if (!prev) {
      emitNewOrder(order)
      try {
        await addPrintJob(order)
      } catch (err) {
        console.error('Failed to queue print job:', err.message)
      }
    } else if (prev.status !== order.status) {
      emitOrderStatusChanged(order)
    }
  }

  response.json({ ok: true, ...result })
})
