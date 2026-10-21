import type { Product } from '@/data/mock-products'

export type ReorderItem = { id: string; name: string; price: number; quantity: number }

/**
 * Converte os itens de um pedido antigo ("2x Calabresa (M)") de volta em itens do carrinho,
 * usando o cardápio atual. Itens que não existem mais ou meio a meio ficam em `missing`.
 */
export function rebuildCartItems(orderItems: string[], products: Product[]) {
  const items: ReorderItem[] = []
  const missing: string[] = []

  for (const line of orderItems) {
    const match = /^(\d+)x\s+(.+)$/.exec(line)
    const quantity = match ? Number(match[1]) : 1
    const label = match ? match[2] : line
    const sized = /^(.*) \((P|M|G)\)$/.exec(label)
    const baseName = sized ? sized[1] : label
    const size = sized ? (sized[2] as 'P' | 'M' | 'G') : undefined
    const product = products.find((candidate) => candidate.available && candidate.name === baseName)
    const price = size ? product?.sizePrices?.find((entry) => entry.size === size)?.price : product?.price

    if (!product || price === undefined) {
      missing.push(line)
      continue
    }
    items.push({ id: size ? `${product.id}-${size}` : product.id, name: label, price, quantity })
  }

  return { items, missing }
}
