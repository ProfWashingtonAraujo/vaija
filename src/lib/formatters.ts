export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

export const formatNumber = (value: number) =>
  new Intl.NumberFormat('pt-BR').format(value)
