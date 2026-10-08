import type { Order, OrderStatus } from '@/data/mock-orders'
import type { Product } from '@/data/mock-products'

export type ReportPeriod = 'today' | '7d' | '30d'

export const reportPeriodLabels: Record<ReportPeriod, string> = {
  today: 'Hoje',
  '7d': 'Últimos 7 dias',
  '30d': 'Últimos 30 dias',
}

const periodDays: Record<ReportPeriod, number> = { today: 1, '7d': 7, '30d': 30 }

const statusLabels: Partial<Record<OrderStatus, string>> = {
  'Em preparo': 'Em produção',
  'Em producao': 'Em produção',
  'Saiu para entrega': 'Em entrega',
}

function parseItem(item: string) {
  const match = item.match(/^(\d+)x\s+(.*)$/)
  return { quantity: match ? Number(match[1]) : 1, name: match ? match[2] : item }
}

function findCategory(name: string, products: Product[]) {
  const exact = products.find((product) => product.name === name)
  if (exact) return exact.category
  const prefix = products
    .filter((product) => name.startsWith(product.name))
    .sort((a, b) => b.name.length - a.name.length)[0]
  return prefix?.category ?? 'Outros'
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function dayKey(date: Date) {
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`
}

export type ReportData = {
  revenue: number
  completed: number
  cancelled: number
  topProduct: string
  peakHour: string
  dailyRevenue: Array<{ day: string; value: number }>
  statusSeries: Array<{ name: string; value: number }>
  categorySeries: Array<{ name: string; value: number }>
  paymentSeries: Array<{ name: string; value: number }>
  products: Array<{ product: string; category: string; quantity: number; share: number }>
  orderCount: number
}

export function buildReport(allOrders: Order[], products: Product[], period: ReportPeriod): ReportData {
  const today = startOfDay(new Date())
  const from = new Date(today)
  from.setDate(from.getDate() - (periodDays[period] - 1))
  const orders = allOrders.filter((order) => {
    if (!order.createdAt) return false
    const created = new Date(order.createdAt)
    return !Number.isNaN(created.getTime()) && created >= from
  })
  const valid = orders.filter((order) => order.status !== 'Cancelado')

  const daily = new Map<string, number>()
  for (let i = 0; i < periodDays[period]; i++) {
    const day = new Date(from)
    day.setDate(from.getDate() + i)
    daily.set(dayKey(day), 0)
  }
  const status = new Map<string, number>()
  const category = new Map<string, number>()
  const payment = new Map<string, number>()
  const hours = new Array<number>(24).fill(0)
  const productStats = new Map<string, { category: string; quantity: number }>()

  orders.forEach((order) => {
    const label = statusLabels[order.status] ?? order.status
    status.set(label, (status.get(label) ?? 0) + 1)
  })

  valid.forEach((order) => {
    const created = new Date(order.createdAt as string)
    const key = dayKey(created)
    daily.set(key, (daily.get(key) ?? 0) + order.value)
    hours[created.getHours()] += 1
    payment.set(order.payment, (payment.get(order.payment) ?? 0) + 1)
    order.items.forEach((item) => {
      const { quantity, name } = parseItem(item)
      const cat = findCategory(name, products)
      category.set(cat, (category.get(cat) ?? 0) + quantity)
      const current = productStats.get(name) ?? { category: cat, quantity: 0 }
      current.quantity += quantity
      productStats.set(name, current)
    })
  })

  const totalItems = Array.from(productStats.values()).reduce((sum, item) => sum + item.quantity, 0)
  const productRows = Array.from(productStats.entries())
    .map(([product, stats]) => ({ product, category: stats.category, quantity: stats.quantity, share: totalItems ? (stats.quantity / totalItems) * 100 : 0 }))
    .sort((a, b) => b.quantity - a.quantity)

  const peak = Math.max(...hours)
  const peakStart = hours.indexOf(peak)

  return {
    revenue: valid.reduce((sum, order) => sum + order.value, 0),
    completed: orders.filter((order) => order.status === 'Entregue').length,
    cancelled: orders.filter((order) => order.status === 'Cancelado').length,
    topProduct: productRows[0]?.product ?? '—',
    peakHour: peak > 0 ? `${String(peakStart).padStart(2, '0')}h às ${String((peakStart + 1) % 24).padStart(2, '0')}h` : '—',
    dailyRevenue: Array.from(daily.entries()).map(([day, value]) => ({ day, value })),
    statusSeries: Array.from(status.entries()).map(([name, value]) => ({ name, value })),
    categorySeries: Array.from(category.entries()).map(([name, value]) => ({ name, value })),
    paymentSeries: Array.from(payment.entries()).map(([name, value]) => ({ name, value })),
    products: productRows,
    orderCount: orders.length,
  }
}

const money = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function csvCell(value: string | number) {
  const text = String(value)
  return /[;"\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

export function reportToCsv(report: ReportData, periodLabel: string) {
  const rows: Array<Array<string | number>> = [
    ['Relatório', periodLabel],
    [],
    ['Indicador', 'Valor'],
    ['Faturamento total', money(report.revenue)],
    ['Pedidos concluídos', report.completed],
    ['Cancelamentos', report.cancelled],
    ['Produto mais vendido', report.topProduct],
    ['Horário de pico', report.peakHour],
    [],
    ['Dia', 'Faturamento'],
    ...report.dailyRevenue.map((item): Array<string | number> => [item.day, money(item.value)]),
    [],
    ['Status', 'Pedidos'],
    ...report.statusSeries.map((item): Array<string | number> => [item.name, item.value]),
    [],
    ['Forma de pagamento', 'Pedidos'],
    ...report.paymentSeries.map((item): Array<string | number> => [item.name, item.value]),
    [],
    ['Produto', 'Categoria', 'Quantidade', '% das vendas'],
    ...report.products.map((item): Array<string | number> => [item.product, item.category, item.quantity, `${item.share.toFixed(1)}%`]),
  ]
  return '﻿' + rows.map((row) => row.map(csvCell).join(';')).join('\r\n')
}

export function downloadCsv(content: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const htmlEscapes: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }
const escapeHtml = (value: string | number) => String(value).replace(/[&<>"']/g, (char) => htmlEscapes[char])

/** Abre uma janela de impressão; o usuário escolhe "Salvar como PDF". */
export function printReport(report: ReportData, periodLabel: string) {
  const table = (head: string[], body: Array<Array<string | number>>) =>
    `<table><thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead><tbody>${body.map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório - ${escapeHtml(periodLabel)}</title>
<style>body{font-family:Arial,sans-serif;padding:24px;color:#0f172a}h1{margin:0}h2{margin-top:24px;font-size:16px}p{color:#64748b}table{width:100%;border-collapse:collapse;font-size:13px}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e2e8f0}</style></head><body>
<h1>Relatório de vendas</h1><p>${escapeHtml(periodLabel)} · gerado em ${escapeHtml(new Date().toLocaleString('pt-BR'))}</p>
${table(['Indicador', 'Valor'], [['Faturamento total', money(report.revenue)], ['Pedidos concluídos', report.completed], ['Cancelamentos', report.cancelled], ['Produto mais vendido', report.topProduct], ['Horário de pico', report.peakHour]])}
<h2>Faturamento por dia</h2>${table(['Dia', 'Faturamento'], report.dailyRevenue.map((i) => [i.day, money(i.value)]))}
<h2>Pedidos por status</h2>${table(['Status', 'Pedidos'], report.statusSeries.map((i) => [i.name, i.value]))}
<h2>Formas de pagamento</h2>${table(['Forma', 'Pedidos'], report.paymentSeries.map((i) => [i.name, i.value]))}
<h2>Performance de produtos</h2>${table(['Produto', 'Categoria', 'Quantidade', '% das vendas'], report.products.map((i) => [i.product, i.category, i.quantity, `${i.share.toFixed(1)}%`]))}
</body></html>`
  const win = window.open('', '_blank')
  if (!win) return false
  win.document.write(html)
  win.document.close()
  win.focus()
  win.print()
  return true
}
