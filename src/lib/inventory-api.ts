import { readTenantStorage, writeTenantStorage } from '@/lib/tenant-storage'

export type InventoryCategory = 'Ingredientes' | 'Bebidas' | 'Embalagens' | 'Produtos prontos'

export type InventoryItem = {
  id: string
  name: string
  category: InventoryCategory
  unit: string
  quantity: number
  minQuantity: number
  cost: number
  salePrice: number
  menuCategory: string
  description: string
  image: string
  linkedProductId?: string
  usedInProductIds?: string[]
}

const localInventoryKey = 'vaija.inventory'

export const initialInventory: InventoryItem[] = [
  {
    id: 'stock-1',
    name: 'Coca-Cola 600ml',
    category: 'Bebidas',
    unit: 'UN',
    quantity: 36,
    minQuantity: 12,
    cost: 4.5,
    salePrice: 8.5,
    menuCategory: 'Bebidas',
    description: 'Gelada e pronta para acompanhar qualquer pedido.',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80',
    linkedProductId: 'prod-5',
  },
  {
    id: 'stock-2',
    name: 'Burger da Casa',
    category: 'Produtos prontos',
    unit: 'UN',
    quantity: 18,
    minQuantity: 8,
    cost: 16,
    salePrice: 34.9,
    menuCategory: 'Hamburgueres',
    description: 'Pão brioche, carne angus, cheddar e maionese da casa.',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    linkedProductId: 'prod-8',
  },
]

export async function fetchInventory() {
  return readTenantStorage(localInventoryKey, initialInventory)
}

export async function saveInventory(items: InventoryItem[]) {
  writeTenantStorage(localInventoryKey, items)
  return items
}
