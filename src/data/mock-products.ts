export type ProductCategory =
  | 'Pizzas Especiais'
  | 'Pizzas Doces'
  | 'Hamburgueres'
  | 'Bebidas'
  | 'Pizzas Salgadas'

export type Product = {
  id: string
  name: string
  price: number
  category: ProductCategory
  description: string
  image: string
  available: boolean
}

export const products: Product[] = [
  {
    id: 'prod-1',
    name: 'Pepperoni Premium',
    price: 64.9,
    category: 'Pizzas Especiais',
    description: 'Molho italiano, pepperoni artesanal e blend especial de queijos.',
    image: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?auto=format&fit=crop&w=800&q=80',
    available: true,
  },
  {
    id: 'prod-2',
    name: 'Trufa & Cogumelos',
    price: 89,
    category: 'Pizzas Especiais',
    description: 'Shiitake, champignon paris e toque de azeite trufado.',
    image: 'https://images.unsplash.com/photo-1541745537411-b8046dc6d66c?auto=format&fit=crop&w=800&q=80',
    available: true,
  },
  {
    id: 'prod-3',
    name: 'Margherita D.O.P',
    price: 58,
    category: 'Pizzas Salgadas',
    description: 'Mozzarella premium, tomate confit e manjericao fresco.',
    image: 'https://images.unsplash.com/photo-1604382355076-af4b0eb60143?auto=format&fit=crop&w=800&q=80',
    available: true,
  },
  {
    id: 'prod-4',
    name: 'Quattro Formaggi + Mel',
    price: 72.5,
    category: 'Pizzas Especiais',
    description: 'Mix de quatro queijos nobres finalizado com mel picante.',
    image: 'https://images.unsplash.com/photo-1594007654729-407eedc4be65?auto=format&fit=crop&w=800&q=80',
    available: true,
  },
  {
    id: 'prod-5',
    name: 'Coca-Cola 600ml',
    price: 8.5,
    category: 'Bebidas',
    description: 'Gelada e pronta para acompanhar qualquer pedido.',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?auto=format&fit=crop&w=800&q=80',
    available: true,
  },
  {
    id: 'prod-6',
    name: 'Chocolate & Morango',
    price: 52,
    category: 'Pizzas Doces',
    description: 'Ganache cremoso, morangos frescos e raspas especiais.',
    image: 'https://images.unsplash.com/photo-1519864600265-abb23847ef2c?auto=format&fit=crop&w=800&q=80',
    available: false,
  },
  {
    id: 'prod-7',
    name: 'Calabresa Gourmet',
    price: 61,
    category: 'Pizzas Salgadas',
    description: 'Calabresa premium, cebola roxa e cobertura generosa.',
    image: 'https://images.unsplash.com/photo-1511689660979-10d2b1aada49?auto=format&fit=crop&w=800&q=80',
    available: true,
  },
  {
    id: 'prod-8',
    name: 'Burger da Casa',
    price: 34.9,
    category: 'Hamburgueres',
    description: 'Pao brioche, carne angus, cheddar e maionese da casa.',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&q=80',
    available: true,
  },
  {
    id: 'prod-9',
    name: 'Coca-Cola 2L',
    price: 14,
    category: 'Bebidas',
    description: 'Ideal para pedidos em familia.',
    image: 'https://images.unsplash.com/photo-1554866585-cd94860890b7?auto=format&fit=crop&w=800&q=80',
    available: true,
  },
]

export const posCategories = ['Pizzas Especiais', 'Pizzas Doces', 'Hamburgueres', 'Bebidas'] as const
export const menuCategories = ['Todas', 'Pizzas Salgadas', 'Pizzas Doces', 'Bebidas'] as const
