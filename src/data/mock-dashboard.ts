export const dashboardMetrics: Array<{
  label: string
  value: number
  trend: string
  icon: 'Wallet' | 'Receipt' | 'ChartPie' | 'Bike'
}> = [
  { label: 'Vendas hoje', value: 2840, trend: '+12% vs. ontem', icon: 'Wallet' },
  { label: 'Novos pedidos', value: 42, trend: '+8% vs. ontem', icon: 'Receipt' },
  { label: 'Ticket médio', value: 67.6, trend: '-3% vs. ontem', icon: 'ChartPie' },
  { label: 'Taxa de entrega', value: 380, trend: '+15% vs. ontem', icon: 'Bike' },
]

export const revenueSeries = [
  { day: 'Seg', revenue: 2100 },
  { day: 'Ter', revenue: 2450 },
  { day: 'Qua', revenue: 2320 },
  { day: 'Qui', revenue: 2780 },
  { day: 'Sex', revenue: 3320 },
  { day: 'Sab', revenue: 3890 },
  { day: 'Dom', revenue: 3010 },
]

export const categorySeries = [
  { name: 'Pizzas', value: 52 },
  { name: 'Bebidas', value: 18 },
  { name: 'Burgers', value: 16 },
  { name: 'Batatas Fritas', value: 14 },
]
