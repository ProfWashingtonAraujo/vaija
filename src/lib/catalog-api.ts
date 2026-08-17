import { products as initialProducts, type Product } from '@/data/mock-products'
import { readTenantFlag, readTenantStorage, writeTenantFlag, writeTenantStorage, getTenantId } from '@/lib/tenant-storage'
import { apiFetch } from '@/lib/api-client'
import { getBusinessCategories, type BusinessType } from '@/lib/business-types'

export type CategoryRecord = {
  name: string
  menuEnabled: boolean
  posEnabled: boolean
}

const localProductsKey = 'vaija.products'
const localCategoriesKey = 'vaija.categories'
const specialPizzasSeedKey = 'vaija.products.seed.special-pizzas-v3'
const pizzaSizesSeedKey = 'vaija.products.seed.pizza-sizes-v1'
const premiumCategorySeedKey = 'vaija.products.seed.premium-category-v1'
const esfiraSeedKey = 'vaija.products.seed.esfiras-v1'
const traditionalSeedKey = 'vaija.products.seed.tradicionais-v1'
const removeDessertsSeedKey = 'vaija.products.seed.remove-sobremesas-v1'
const specialPizzaIds = [
  'prod-special-bacon',
  'prod-special-carne-de-sol',
  'prod-special-caipirao',
  'prod-special-portuguesa',
  'prod-special-franbacon',
  'prod-special-picante',
  'prod-special-moda-da-casa',
  'prod-sweet-oreo',
  'prod-sweet-avela',
  'prod-sweet-chocolate-branco',
  'prod-sweet-chocolate',
  'prod-sweet-kitkat',
  'prod-sweet-duo',
  'prod-sweet-mms',
  'prod-sweet-bolo-de-rolo',
  'prod-premium-4-queijos',
  'prod-premium-nordestina',
  'prod-premium-nordestina-cheese',
  'prod-premium-frango-cheese',
  'prod-premium-calabresa-cheese',
  'prod-premium-sol-cheese',
  'prod-premium-costela-cheese',
  'prod-premium-calabresa-a-moda-taperas',
  'prod-premium-lombinho',
  'prod-premium-peperony',
  'prod-premium-brocolis-e-bacon',
  'prod-premium-trio-cremoso',
  'prod-premium-costela',
]

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

const premiumPizzaIds = [
  'prod-premium-4-queijos',
  'prod-premium-nordestina',
  'prod-premium-nordestina-cheese',
  'prod-premium-frango-cheese',
  'prod-premium-calabresa-cheese',
  'prod-premium-sol-cheese',
  'prod-premium-costela-cheese',
  'prod-premium-calabresa-a-moda-taperas',
  'prod-premium-lombinho',
  'prod-premium-peperony',
  'prod-premium-brocolis-e-bacon',
  'prod-premium-trio-cremoso',
  'prod-premium-costela',
]

const esfiraProductIds = [
  'prod-esfira-premium-carne-de-sol-cheese',
  'prod-esfira-premium-frango-cheese',
  'prod-esfira-premium-calabresa-cheese',
  'prod-esfira-premium-4-queijos',
  'prod-esfira-tradicional-bacon',
  'prod-esfira-tradicional-calabresa',
  'prod-esfira-tradicional-carne-de-sol',
  'prod-esfira-tradicional-frango',
  'prod-esfira-tradicional-mista',
  'prod-esfira-tradicional-picante',
  'prod-esfira-tradicional-marguerita',
  'prod-esfira-doce-chocolate-ao-leite',
  'prod-esfira-doce-avela',
  'prod-esfira-doce-chocolate-branco',
  'prod-esfira-doce-duo',
  'prod-esfira-doce-bolo-de-rolo',
  'prod-esfira-doce-kitkat',
  'prod-esfira-doce-mms',
  'prod-bebida-sucos-400ml',
  'prod-bebida-refrigerante-1l',
  'prod-bebida-refrigerante-15l',
  'prod-bebida-refrigerante-2l',
  'prod-bebida-refrigerante-lata',
  'prod-adicional-1-ovo',
  'prod-adicional-2-ovos',
  'prod-adicional-bacon',
  'prod-adicional-presunto',
  'prod-adicional-calabresa',
  'prod-adicional-cream-cheese',
  'prod-adicional-frango',
]

const traditionalProductIds = [
  'prod-tradicional-calabresa',
  'prod-tradicional-marguerita',
  'prod-tradicional-mussarela',
  'prod-tradicional-mista',
  'prod-tradicional-frango-caipira',
  'prod-tradicional-frango',
  'prod-tradicional-milho-verde',
  'prod-batata-tradicional-300g',
  'prod-batata-cheddar-bacon-300g',
  'prod-hamburguer-1',
  'prod-hamburguer-2',
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
  for (const seedKey of [specialPizzasSeedKey, pizzaSizesSeedKey, premiumCategorySeedKey, esfiraSeedKey, traditionalSeedKey, removeDessertsSeedKey]) {
    writeTenantFlag(seedKey, 'true', tenantId)
  }
}

export async function fetchProducts(): Promise<Product[]> {
  if (import.meta.env.VITE_OFFLINE_MODE !== 'true') {
    const response = await apiFetch('/api/products', { headers: getTenantHeaders() })
    if (!response.ok) throw new Error(`failed_to_fetch_products:${response.status}`)
    const data = await response.json()
    return data.products || []
  }

  const products = readTenantStorage(localProductsKey, initialProducts)

  if (!readTenantFlag(specialPizzasSeedKey)) {
    const existingIds = new Set(products.map((product) => product.id))
    const missingSpecialPizzas = initialProducts.filter((product) => specialPizzaIds.includes(product.id) && !existingIds.has(product.id))

    if (missingSpecialPizzas.length > 0) {
      const nextProducts = [...missingSpecialPizzas, ...products]
      writeTenantStorage(localProductsKey, nextProducts)
      writeTenantFlag(specialPizzasSeedKey, 'true')
      return nextProducts
    }

    writeTenantFlag(specialPizzasSeedKey, 'true')
  }

  if (!readTenantFlag(pizzaSizesSeedKey)) {
    const specialProducts = new Map(initialProducts.filter((product) => specialPizzaIds.includes(product.id)).map((product) => [product.id, product]))
    const nextProducts = products.map((product) => {
      const seededProduct = specialProducts.get(product.id)
      return seededProduct?.sizePrices ? { ...product, sizePrices: seededProduct.sizePrices, price: seededProduct.price } : product
    })

    writeTenantStorage(localProductsKey, nextProducts)
    writeTenantFlag(pizzaSizesSeedKey, 'true')
    return nextProducts
  }

  if (!readTenantFlag(premiumCategorySeedKey)) {
    const nextProducts = products.map((product) => premiumPizzaIds.includes(product.id) ? { ...product, category: 'Premium' as Product['category'] } : product)
    writeTenantStorage(localProductsKey, nextProducts)
    writeTenantFlag(premiumCategorySeedKey, 'true')
    return nextProducts
  }

  if (!readTenantFlag(esfiraSeedKey)) {
    const existingIds = new Set(products.map((product) => product.id))
    const missingProducts = initialProducts.filter((product) => esfiraProductIds.includes(product.id) && !existingIds.has(product.id))

    if (missingProducts.length > 0) {
      const nextProducts = [...missingProducts, ...products]
      writeTenantStorage(localProductsKey, nextProducts)
      writeTenantFlag(esfiraSeedKey, 'true')
      return nextProducts
    }

    writeTenantFlag(esfiraSeedKey, 'true')
  }

  if (!readTenantFlag(traditionalSeedKey)) {
    const existingIds = new Set(products.map((product) => product.id))
    const migratedProducts = products.map((product) => String(product.category) === 'Pizzas Salgadas' ? { ...product, category: 'Pizzas Tradicionais' as Product['category'] } : product)
    const missingProducts = initialProducts.filter((product) => traditionalProductIds.includes(product.id) && !existingIds.has(product.id))
    const nextProducts = [...missingProducts, ...migratedProducts]

    writeTenantStorage(localProductsKey, nextProducts)
    writeTenantFlag(traditionalSeedKey, 'true')
    return nextProducts
  }

  if (!readTenantFlag(removeDessertsSeedKey)) {
    const nextProducts = products.map((product) => String(product.category) === 'Sobremesas' ? { ...product, category: 'Batatas Fritas' as Product['category'] } : product)
    writeTenantStorage(localProductsKey, nextProducts)
    writeTenantFlag(removeDessertsSeedKey, 'true')
    return nextProducts
  }

  return products
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
