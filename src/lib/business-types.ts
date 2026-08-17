export type BusinessType = 'pizzeria' | 'hamburger' | 'restaurant' | 'confectionery' | 'delivery'

export const businessTypeOptions: Array<{ value: BusinessType; label: string; description: string }> = [
  { value: 'pizzeria', label: 'Pizzaria', description: 'Pizzas, bordas, porções, bebidas e adicionais.' },
  { value: 'hamburger', label: 'Hamburgueria', description: 'Hambúrgueres, combos, acompanhamentos e bebidas.' },
  { value: 'restaurant', label: 'Restaurante', description: 'Entradas, pratos, sobremesas e bebidas.' },
  { value: 'confectionery', label: 'Confeitaria', description: 'Bolos, doces, salgados, kits e bebidas.' },
  { value: 'delivery', label: 'Delivery', description: 'Combos, refeições, porções, bebidas e adicionais.' },
]

export const businessTypeLabels = Object.fromEntries(businessTypeOptions.map((option) => [option.value, option.label])) as Record<BusinessType, string>

const categoryNames: Record<BusinessType, string[]> = {
  pizzeria: ['Pizzas Tradicionais', 'Pizzas Especiais', 'Pizzas Doces', 'Bordas', 'Porções', 'Bebidas', 'Adicionais'],
  hamburger: ['Hambúrgueres', 'Combos', 'Acompanhamentos', 'Porções', 'Sobremesas', 'Bebidas', 'Adicionais'],
  restaurant: ['Entradas', 'Pratos principais', 'Pratos executivos', 'Acompanhamentos', 'Sobremesas', 'Bebidas'],
  confectionery: ['Bolos', 'Doces', 'Salgados', 'Kits e caixas', 'Sobremesas', 'Bebidas'],
  delivery: ['Combos', 'Refeições', 'Lanches', 'Porções', 'Sobremesas', 'Bebidas', 'Adicionais'],
}

export function getBusinessCategories(businessType: BusinessType) {
  return categoryNames[businessType].map((name) => ({ name, menuEnabled: true, posEnabled: true }))
}
