export type ProductCategory = string

export type Product = {
  id: string
  name: string
  price: number
  sizePrices?: Array<{ size: 'P' | 'M' | 'G'; price: number }>
  category: ProductCategory
  description: string
  image: string
  available: boolean
  /** Ingredientes usados na receita (controle de "em falta"). */
  ingredients?: string[]
  /** Preenchido pela API: ingredientes em falta que bloqueiam a venda deste produto. */
  blockedBy?: string[]
}

export const posCategories = ['Pizzas Tradicionais', 'Pizzas Especiais', 'Premium', 'Pizzas Doces', 'Esfira Premium', 'Esfira Tradicional', 'Esfira Doce', 'Hamburgueres', 'Batatas Fritas', 'Bebidas', 'Adicionais'] as const
export const menuCategories = ['Todas', 'Pizzas Tradicionais', 'Pizzas Especiais', 'Premium', 'Pizzas Doces', 'Esfira Premium', 'Esfira Tradicional', 'Esfira Doce', 'Hamburgueres', 'Batatas Fritas', 'Bebidas', 'Adicionais'] as const
