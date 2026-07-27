import { Router } from 'express'
import { getCategories, getProducts, updateProducts } from '../services/catalog-service.js'
import { isValidProductsPayload } from '../validators/product-validator.js'

export const catalogRouter = Router()

catalogRouter.get('/categories', async (_request, response) => {
  const categories = await getCategories()
  response.json({ categories })
})

catalogRouter.get('/products', async (_request, response) => {
  const products = await getProducts()
  response.json({ products })
})

catalogRouter.put('/products', async (request, response) => {
  if (!isValidProductsPayload(request.body)) {
    response.status(400).json({ ok: false, error: 'invalid_products_payload' })
    return
  }

  const result = await updateProducts(request.body.products)
  response.json({ ok: true, ...result })
})
