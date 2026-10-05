import type { Product } from '@/data/mock-products'

export type PizzaSize = 'P' | 'M' | 'G'

export const pizzaSizes: PizzaSize[] = ['P', 'M', 'G']
export const pizzaSizeLabels: Record<PizzaSize, string> = { P: 'Pequena', M: 'Média', G: 'Grande' }

/** Regras do meio a meio. Para mudar o comportamento, ajuste só aqui. */
export const halfAndHalfRules = {
  /** 'highest' cobra o sabor mais caro; 'average' cobra a média das duas metades. */
  pricing: 'highest' as 'highest' | 'average',
}

export type HalfAndHalfItem = { id: string; name: string; price: number }

/** Só pizzas com tamanhos (P/M/G) podem ser divididas. */
export function isHalfEligible(product: Product) {
  return Boolean(product.sizePrices?.length)
}

function priceAt(product: Product, size: PizzaSize) {
  return product.sizePrices?.find((item) => item.size === size)?.price
}

/** Tamanhos que existem nas duas pizzas. */
export function sizesInCommon(a: Product, b: Product): PizzaSize[] {
  return pizzaSizes.filter((size) => priceAt(a, size) !== undefined && priceAt(b, size) !== undefined)
}

export function halfAndHalfPrice(a: Product, b: Product, size: PizzaSize): number | undefined {
  const priceA = priceAt(a, size)
  const priceB = priceAt(b, size)
  if (priceA === undefined || priceB === undefined) return undefined
  return halfAndHalfRules.pricing === 'average' ? Math.round(((priceA + priceB) / 2) * 100) / 100 : Math.max(priceA, priceB)
}

/**
 * Item de carrinho do meio a meio. O id não depende da ordem das metades (mesma combinação soma
 * quantidade) e o nome usa "1/2" em ASCII para sair certo na impressora térmica.
 */
export function buildHalfAndHalfItem(a: Product, b: Product, size: PizzaSize): HalfAndHalfItem | undefined {
  const price = halfAndHalfPrice(a, b, size)
  if (price === undefined) return undefined
  return {
    id: `half-${[a.id, b.id].sort().join('+')}-${size}`,
    name: `Meio a meio (${size}): 1/2 ${a.name} + 1/2 ${b.name}`,
    price,
  }
}
