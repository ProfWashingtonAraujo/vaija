import { Router } from 'express'
import { getCategories, getProducts, updateProducts, updateCategories } from '../services/catalog-service.js'
import { isValidProductsPayload } from '../validators/product-validator.js'

export const catalogRouter = Router()

catalogRouter.get('/categories', async (request, response) => {
  const tenantId = request.auth?.tenantId || 'default'
  const categories = await getCategories(tenantId)
  response.json({ categories })
})

catalogRouter.get('/products', async (request, response) => {
  const tenantId = request.auth?.tenantId || 'default'
  const products = await getProducts(tenantId)
  response.json({ products })
})

catalogRouter.put('/products', async (request, response) => {
  if (!isValidProductsPayload(request.body)) {
    response.status(400).json({ ok: false, error: 'invalid_products_payload' })
    return
  }

  const tenantId = request.auth?.tenantId || 'default'
  const result = await updateProducts(request.body.products, tenantId)
  response.json({ ok: true, ...result })
})

catalogRouter.put('/categories', async (request, response) => {
  const tenantId = request.auth?.tenantId || 'default'
  const result = await updateCategories(request.body.categories, tenantId)
  response.json({ ok: true, ...result })
})
