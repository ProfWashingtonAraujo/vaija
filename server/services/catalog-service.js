import { listCategories, listProducts, replaceProducts } from '../repositories/products-repository.js'

export async function getCategories() {
  return listCategories()
}

export async function getProducts() {
  return listProducts()
}

export async function updateProducts(nextProducts) {
  const products = await replaceProducts(nextProducts)
  return { products }
}
