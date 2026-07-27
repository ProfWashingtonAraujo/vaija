import type { Product } from '@/data/mock-products'
import { apiFetch } from '@/lib/api-client'

export type CategoryRecord = {
  name: string
  menuEnabled: boolean
  posEnabled: boolean
}

export async function fetchCategories() {
  const response = await apiFetch('/api/categories')

  if (!response.ok) {
    throw new Error('failed_to_fetch_categories')
  }

  const data = await response.json() as { categories: CategoryRecord[] }
  return data.categories
}

export async function fetchProducts() {
  const response = await apiFetch('/api/products')

  if (!response.ok) {
    throw new Error('failed_to_fetch_products')
  }

  const data = await response.json() as { products: Product[] }
  return data.products
}

export async function saveProducts(products: Product[]) {
  const response = await apiFetch('/api/products', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ products }),
  })

  if (!response.ok) {
    throw new Error('failed_to_save_products')
  }

  const data = await response.json() as { products: Product[] }
  return data.products
}
