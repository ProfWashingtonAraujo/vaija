import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, Clock, PackageCheck, Search, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency } from '@/lib/formatters'
import { fetchOrders } from '@/lib/orders-api'
import type { Order, OrderStatus } from '@/data/mock-orders'
import { readSettings } from '@/lib/settings'

const trackingSteps: Array<{ status: OrderStatus; label: string; description: string; icon: typeof Clock }> = [
  { status: 'Pendente', label: 'Pedido recebido', description: 'Seu pedido entrou na fila do restaurante.', icon: Clock },
  { status: 'Em producao', label: 'Em produção', description: 'A equipe está preparando seus itens.', icon: PackageCheck },
  { status: 'Pronto para retirada', label: 'Pronto', description: 'Seu pedido está pronto para retirada ou envio.', icon: CheckCircle2 },
  { status: 'Saiu para entrega', label: 'Saiu para entrega', description: 'O pedido está a caminho do endereço informado.', icon: Truck },
  { status: 'Entregue', label: 'Entregue', description: 'Pedido finalizado. Bom apetite!', icon: CheckCircle2 },
]

function normalizePhone(value: string) {
  return value.replace(/\D/g, '')
}

function getStepIndex(status: OrderStatus) {
  const index = trackingSteps.findIndex((step) => step.status === status)
  return index >= 0 ? index : 0
}

export function CustomerTrackingPage() {
  const [searchParams] = useSearchParams()
  const [orders, setOrders] = useState<Order[]>([])
  const [query, setQuery] = useState(searchParams.get('pedido') ?? '')
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null)
  const [restaurantSettings] = useState(() => readSettings().restaurant)

  useEffect(() => {
    void fetchOrders()
      .then((loadedOrders) => {
        setOrders(loadedOrders)
        const orderId = Number(searchParams.get('pedido'))
        if (!Number.isNaN(orderId)) {
          setSelectedOrderId(loadedOrders.find((order) => order.id === orderId)?.id ?? null)
        }
      })
      .catch(() => toast.error('Não foi possível carregar seus pedidos.'))
  }, [searchParams])

  const foundOrders = useMemo(() => {
    const trimmedQuery = query.trim()
    const queryPhone = normalizePhone(trimmedQuery)

    if (!trimmedQuery) {
      return []
    }

    return orders.filter((order) => String(order.id) === trimmedQuery || (queryPhone.length > 0 && normalizePhone(order.phone).includes(queryPhone)))
  }, [orders, query])

  const selectedOrder = orders.find((order) => order.id === selectedOrderId) ?? foundOrders[0]
  const activeStep = selectedOrder ? getStepIndex(selectedOrder.status) : 0

  const handleSearch = () => {
    if (!query.trim()) {
      toast.error('Informe o número do pedido ou WhatsApp.')
      return
    }

    if (foundOrders.length === 0) {
      setSelectedOrderId(null)
      toast.error('Nenhum pedido encontrado com esses dados.')
      return
    }

    setSelectedOrderId(foundOrders[0].id)
  }

  return (
    <main className="min-h-screen bg-[#fff8f1] text-slate-900">
      <section className="bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <Link to="/pedido" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-100 hover:text-white"><ArrowLeft className="h-4 w-4" />Voltar ao cardápio</Link>
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orange-200">Acompanhamento</p>
              <h1 className="mt-3 font-heading text-4xl font-black sm:text-5xl">Veja o status do seu pedido</h1>
              <p className="mt-4 max-w-2xl text-orange-50">Acompanhe em tempo real conforme o {restaurantSettings.name} avança o pedido na operação.</p>
            </div>
            <div className="rounded-[28px] border border-white/15 bg-white/10 p-4 backdrop-blur">
              <p className="text-sm text-orange-50">Busque por</p>
              <p className="mt-1 font-heading text-2xl font-bold">Número do pedido ou WhatsApp</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:px-8">
        <aside className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)] lg:self-start">
          <h2 className="font-heading text-2xl font-bold">Encontrar pedido</h2>
          <div className="mt-4 grid gap-3">
            <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex: 4852 ou WhatsApp" inputMode="search" />
            <Button onClick={handleSearch}><Search className="mr-2 h-4 w-4" />Acompanhar</Button>
          </div>

          {foundOrders.length > 1 ? (
            <div className="mt-5 space-y-2">
              <p className="text-sm font-semibold text-slate-700">Pedidos encontrados</p>
              {foundOrders.map((order) => (
                <button key={order.id} type="button" onClick={() => setSelectedOrderId(order.id)} className="w-full rounded-2xl border border-orange-100 bg-white p-3 text-left text-sm transition hover:border-orange-300 hover:bg-orange-50/60">
                  <span className="block font-mono font-semibold">#{order.id}</span>
                  <span className="mt-1 block text-slate-500">{order.time} · {formatCurrency(order.value)}</span>
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <div className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          {!selectedOrder ? (
            <div className="flex min-h-80 flex-col items-center justify-center rounded-[24px] border border-dashed border-orange-200 bg-orange-50/50 p-6 text-center">
              <Clock className="h-8 w-8 text-orange-500" />
              <h2 className="mt-4 font-heading text-2xl font-bold">Informe seus dados para acompanhar</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">Digite o número do pedido ou o WhatsApp usado no checkout.</p>
            </div>
          ) : (
            <div>
              <div className="flex flex-col gap-3 border-b border-orange-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-mono text-sm font-semibold text-slate-500">Pedido #{selectedOrder.id}</p>
                  <h2 className="mt-2 font-heading text-3xl font-bold">{selectedOrder.customer}</h2>
                  <p className="mt-1 text-sm text-slate-500">Recebido às {selectedOrder.time}</p>
                </div>
                <StatusBadge status={selectedOrder.status} />
              </div>

              <div className="mt-6 space-y-4">
                {trackingSteps.map((step, index) => {
                  const Icon = step.icon
                  const completed = index <= activeStep
                  return (
                    <div key={step.status} className="flex gap-4">
                      <div className="flex flex-col items-center">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl border ${completed ? 'border-orange-500 bg-orange-500 text-white' : 'border-orange-100 bg-orange-50 text-orange-300'}`}><Icon className="h-5 w-5" /></div>
                        {index < trackingSteps.length - 1 ? <div className={`mt-2 h-10 w-px ${index < activeStep ? 'bg-orange-400' : 'bg-orange-100'}`} /> : null}
                      </div>
                      <div className="pb-4">
                        <p className={`font-semibold ${completed ? 'text-slate-900' : 'text-slate-400'}`}>{step.label}</p>
                        <p className="mt-1 text-sm leading-6 text-slate-500">{step.description}</p>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="mt-6 grid gap-4 rounded-[24px] border border-orange-100 bg-orange-50/40 p-4 text-sm text-slate-600 sm:grid-cols-2">
                <div><span className="font-semibold text-slate-900">Total:</span> {formatCurrency(selectedOrder.value)}</div>
                <div><span className="font-semibold text-slate-900">Pagamento:</span> {selectedOrder.payment}</div>
                <div className="sm:col-span-2"><span className="font-semibold text-slate-900">Endereço:</span> {selectedOrder.address}</div>
                {selectedOrder.notes ? <div className="sm:col-span-2"><span className="font-semibold text-slate-900">Observação:</span> {selectedOrder.notes}</div> : null}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}
