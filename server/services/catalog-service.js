import { listCategories, listProducts, replaceProducts, replaceCategories } from '../repositories/products-repository.js'

export async function getCategories(tenantId = 'default') {
  return listCategories(tenantId)
}

export async function getProducts(tenantId = 'default') {
  return listProducts(tenantId)
}

export async function updateProducts(nextProducts, tenantId = 'default') {
  const products = await replaceProducts(nextProducts, tenantId)
  return { products }
}

export async function updateCategories(nextCategories, tenantId = 'default') {
  const categories = await replaceCategories(nextCategories, tenantId)
  return { categories }
}
