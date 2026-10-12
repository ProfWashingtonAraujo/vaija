import type { Product } from '@/data/mock-products'
import { readTenantStorage, writeTenantStorage, getTenantId } from '@/lib/tenant-storage'
import { apiFetch } from '@/lib/api-client'
import { getBusinessCategories, type BusinessType } from '@/lib/business-types'

export type CategoryRecord = {
  name: string
  menuEnabled: boolean
  posEnabled: boolean
}

const localProductsKey = 'vaija.products'
const localCategoriesKey = 'vaija.categories'
const localCategories: CategoryRecord[] = [
  { name: 'Pizzas Especiais', menuEnabled: true, posEnabled: true },
  { name: 'Premium', menuEnabled: true, posEnabled: true },
  { name: 'Pizzas Tradicionais', menuEnabled: true, posEnabled: true },
  { name: 'Pizzas Doces', menuEnabled: true, posEnabled: true },
  { name: 'Esfira Premium', menuEnabled: true, posEnabled: true },
  { name: 'Esfira Tradicional', menuEnabled: true, posEnabled: true },
  { name: 'Esfira Doce', menuEnabled: true, posEnabled: true },
  { name: 'Hamburgueres', menuEnabled: true, posEnabled: true },
  { name: 'Batatas Fritas', menuEnabled: true, posEnabled: true },
  { name: 'Bebidas', menuEnabled: true, posEnabled: true },
  { name: 'Adicionais', menuEnabled: true, posEnabled: true },
]

function getTenantHeaders(): HeadersInit {
  const tenantId = getTenantId()
  return { 'X-Tenant-Id': tenantId }
}

export async function fetchCategories(): Promise<CategoryRecord[]> {
  if (import.meta.env.VITE_OFFLINE_MODE === 'true') return readTenantStorage(localCategoriesKey, localCategories)
  const response = await apiFetch('/api/categories', { headers: getTenantHeaders() })
  if (!response.ok) throw new Error(`failed_to_fetch_categories:${response.status}`)
  const data = await response.json()
  return data.categories || []
}

export async function fetchPublicCategories(tenantId = 'default'): Promise<CategoryRecord[]> {
  const response = await apiFetch(`/api/public/${encodeURIComponent(tenantId)}/categories`, undefined, false)
  if (!response.ok) throw new Error(`failed_to_fetch_public_categories:${response.status}`)
  const data = await response.json()
  return data.categories || []
}

export async function saveCategories(categories: CategoryRecord[]): Promise<CategoryRecord[]> {
  if (import.meta.env.VITE_OFFLINE_MODE === 'true') {
    writeTenantStorage(localCategoriesKey, categories)
    return categories
  }
  const response = await apiFetch('/api/categories', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
    body: JSON.stringify({ categories }),
  })
  if (!response.ok) throw new Error(`failed_to_save_categories:${response.status}`)
  return categories
}

export function initializeOfflineCatalog(tenantId: string, businessType: BusinessType) {
  writeTenantStorage(localCategoriesKey, getBusinessCategories(businessType), tenantId)
  writeTenantStorage(localProductsKey, [], tenantId)
}

export async function fetchProducts(): Promise<Product[]> {
  if (import.meta.env.VITE_OFFLINE_MODE !== 'true') {
    const response = await apiFetch('/api/products', { headers: getTenantHeaders() })
    if (!response.ok) throw new Error(`failed_to_fetch_products:${response.status}`)
    const data = await response.json()
    return data.products || []
  }

  return readTenantStorage<Product[]>(localProductsKey, [])
}

export async function fetchPublicProducts(tenantId = 'default'): Promise<Product[]> {
  const response = await apiFetch(`/api/public/${encodeURIComponent(tenantId)}/products`, undefined, false)
  if (!response.ok) throw new Error(`failed_to_fetch_public_products:${response.status}`)
  const data = await response.json()
  return data.products || []
}

export async function saveProducts(products: Product[]): Promise<Product[]> {
  if (import.meta.env.VITE_OFFLINE_MODE === 'true') {
    writeTenantStorage(localProductsKey, products)
    return products
  }
  const response = await apiFetch('/api/products', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
    body: JSON.stringify({ products }),
  })
  if (!response.ok) throw new Error(`failed_to_save_products:${response.status}`)
  return products
}

export type IngredientRecord = {
  name: string
  missing: boolean
  productCount: number
}

export async function fetchIngredients(): Promise<IngredientRecord[]> {
  const response = await apiFetch('/api/ingredients', { headers: getTenantHeaders() })
  if (!response.ok) throw new Error(`failed_to_fetch_ingredients:${response.status}`)
  const data = await response.json()
  return data.ingredients || []
}

export async function addIngredient(name: string): Promise<IngredientRecord> {
  const response = await apiFetch('/api/ingredients', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
    body: JSON.stringify({ name }),
  })
  if (!response.ok) throw new Error(`failed_to_add_ingredient:${response.status}`)
  const data = await response.json() as { ingredient: { name: string; missing: boolean } }
  return { ...data.ingredient, productCount: 0 }
}

/** Remove o ingrediente da lista geral e de todos os produtos que o usam. */
export async function deleteIngredient(name: string): Promise<void> {
  const response = await apiFetch(`/api/ingredients?name=${encodeURIComponent(name)}`, {
    method: 'DELETE',
    headers: getTenantHeaders(),
  })
  if (!response.ok) throw new Error(`failed_to_delete_ingredient:${response.status}`)
}

export async function setIngredientMissing(name: string, missing: boolean): Promise<void> {
  const response = await apiFetch('/api/ingredients', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...getTenantHeaders() },
    body: JSON.stringify({ name, missing }),
  })
  if (!response.ok) throw new Error(`failed_to_update_ingredient:${response.status}`)
}

/** Produto à venda agora: ativo no cardápio e sem ingrediente em falta. */
export function isSellable(product: Product) {
  return product.available && !(product.blockedBy?.length)
}
