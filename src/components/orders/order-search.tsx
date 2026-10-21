import { useMemo, useState } from 'react'
import type { Order } from '@/data/mock-orders'
import { SearchInput } from '@/components/shared/search-input'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

type StatusFilter = 'all' | 'open' | 'delivered' | 'cancelled'

const filters: Array<[StatusFilter, string]> = [
  ['all', 'Todos'],
  ['open', 'Em aberto'],
  ['delivered', 'Entregues'],
  ['cancelled', 'Cancelados'],
]

const MAX_RESULTS = 30

function normalize(value: string) {
  return value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

function formatCreatedAt(order: Order) {
  if (!order.createdAt) return order.time
  return new Date(order.createdAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function matchesFilter(order: Order, filter: StatusFilter) {
  if (filter === 'open') return order.status !== 'Entregue' && order.status !== 'Cancelado'
  if (filter === 'delivered') return order.status === 'Entregue'
  if (filter === 'cancelled') return order.status === 'Cancelado'
  return true
}

function searchableText(order: Order) {
  const createdAt = order.createdAt ? new Date(order.createdAt).toLocaleDateString('pt-BR') : ''
  return normalize([`#${order.id}`, order.customer, order.phone, order.phone.replace(/\D/g, ''), order.address, order.items.join(' '), order.payment, order.tableNumber ? `mesa ${order.tableNumber}` : '', createdAt].join(' '))
}

/** Busca em todos os pedidos já carregados, inclusive os que não aparecem nas colunas (em rota, entregues e cancelados). */
export function OrderSearch({ orders, onSelect }: { orders: Order[]; onSelect: (order: Order) => void }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')

  const searching = query.trim() !== '' || filter !== 'all'
  const results = useMemo(() => {
    if (!searching) return []
    const terms = normalize(query).split(/\s+/).filter(Boolean)
    return orders
      .filter((order) => matchesFilter(order, filter) && terms.every((term) => searchableText(order).includes(term)))
      .sort((a, b) => b.id - a.id)
  }, [orders, query, filter, searching])

  return (
    <section className="mb-6 rounded-[30px] border border-orange-100 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="min-w-0 flex-1">
          <SearchInput type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar pedido por número, cliente, telefone, item ou data (ex.: 19/10)" aria-label="Buscar pedidos" />
        </div>
        <div className="flex flex-wrap gap-2">
          {filters.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setFilter(key)}
              aria-pressed={filter === key}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-semibold transition',
                filter === key ? 'border-orange-500 bg-orange-500 text-white' : 'border-orange-100 bg-white text-slate-600 hover:border-orange-300',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {searching ? (
        <div className="mt-4">
          {results.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-center text-sm text-slate-500">Nenhum pedido encontrado.</p>
          ) : (
            <>
              <ul className="max-h-96 divide-y divide-orange-50 overflow-y-auto rounded-2xl border border-orange-100">
                {results.slice(0, MAX_RESULTS).map((order) => (
                  <li key={order.id}>
                    <button type="button" onClick={() => onSelect(order)} className="flex w-full flex-col gap-1 px-4 py-3 text-left transition hover:bg-orange-50/60 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 text-sm">
                          <span className="font-mono font-semibold text-slate-900">#{order.id}</span>
                          <span className="font-semibold text-slate-900">{order.customer}</span>
                          <StatusBadge status={order.status} />
                        </p>
                        <p className="mt-1 truncate text-xs text-slate-500">{order.items.join(' • ')}</p>
                      </div>
                      <div className="shrink-0 text-xs text-slate-500 sm:text-right">
                        <p className="font-mono text-sm font-semibold text-slate-900">{formatCurrency(order.value)}</p>
                        <p>{formatCreatedAt(order)}</p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-xs text-slate-400">
                {results.length > MAX_RESULTS ? `Mostrando os ${MAX_RESULTS} mais recentes de ${results.length}. Refine a busca para ver os outros.` : `${results.length} pedido(s) encontrado(s).`} Toque em um pedido para ver os detalhes.
              </p>
            </>
          )}
        </div>
      ) : null}
    </section>
  )
}
