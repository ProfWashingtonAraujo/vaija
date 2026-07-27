import { Router } from 'express'
import { getOrders, updateOrders } from '../services/orders-service.js'
import { isValidOrdersPayload } from '../validators/order-validator.js'

export const ordersRouter = Router()

ordersRouter.get('/orders', async (_request, response) => {
  const orders = await getOrders()
  response.json({ orders })
})

ordersRouter.put('/orders', async (request, response) => {
  if (!isValidOrdersPayload(request.body)) {
    response.status(400).json({ ok: false, error: 'invalid_orders_payload' })
    return
  }

  const result = await updateOrders(request.body.orders)
  response.json({ ok: true, ...result })
})
