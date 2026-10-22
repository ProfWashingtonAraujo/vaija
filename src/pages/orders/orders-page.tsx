import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { OrderCard } from '@/components/orders/order-card'
import { OrderColumn } from '@/components/orders/order-column'
import { OrderDetailsPanel } from '@/components/orders/order-details-panel'
import { OrderSearch } from '@/components/orders/order-search'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/formatters'
import type { Order, OrderStatus } from '@/data/mock-orders'
import { fetchProducts } from '@/lib/catalog-api'
import type { Product } from '@/data/mock-products'
import { fetchOrders, ProductUnavailableError, saveOrdersKeepingNew, setOrderPaid } from '@/lib/orders-api'
import { usePolling } from '@/lib/use-polling'
import { getTenantId } from '@/lib/tenant-storage'
import { useTenant } from '@/contexts/auth-context'
import { defaultDeliveryFee, resolveOrderSource } from '@/lib/order-source'
import { getCourierUrl, getPublicOrderTrackingUrl } from '@/lib/public-order-url'
import { courierLinkErrorMessage, createCourierLink, fetchDeliveries } from '@/lib/delivery-api'
import { fetchCouriers, whatsappNumber, type Courier } from '@/lib/couriers-api'

const COLUMN_STATUS = {
  Pendente: 'Pendente',
  'Em Produção': 'Em producao',
  'Pronto/Retirada': 'Pronto para retirada',
} as const

type ColumnTitle = keyof typeof COLUMN_STATUS

type OrderFormValues = {
  customer: string
  phone: string
  address: string
  tableNumber: string
  payment: Order['payment']
  notes: string
}

type EditableOrderItem = {
  id: string
  name: string
  price: number
  quantity: number
}

const isClosed = (order: Order) => order.status === 'Entregue' || order.status === 'Cancelado'

/** Mantém o pedido selecionado; sem ele, abre o primeiro pedido em aberto (nunca um já entregue ou cancelado). */
function pickSelected(loaded: Order[], current: Order | null) {
  return loaded.find((order) => order.id === current?.id) ?? loaded.find((order) => !isClosed(order)) ?? null
}

function getOrderFormValues(order: Order): OrderFormValues {
  return {
    customer: order.customer,
    phone: order.phone,
    address: order.address,
    tableNumber: order.tableNumber ?? '',
    payment: order.payment,
    notes: order.notes ?? '',
  }
}

function getOrderItemsFromMenu(order: Order, products: Product[]): EditableOrderItem[] {
  return order.items.map((item, index) => {
    const match = item.match(/^(\d+)x\s+(.+)$/)
    const quantity = match ? Number(match[1]) : 1
    const name = match ? match[2] : item
    const product = products.find((current) => current.name === name)

    return {
      id: product?.id ?? `custom-${order.id}-${index}`,
      name,
      price: product?.price ?? 0,
      quantity,
    }
  })
}

function getWhatsappUrl(order: Order, publicId: string) {
  const phone = order.phone.replace(/\D/g, '')
  const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`
  const trackingUrl = getPublicOrderTrackingUrl(publicId, order.id)
  const message = encodeURIComponent(`Olá, ${order.customer}! Acompanhe o seu pedido #${order.id}: ${trackingUrl}`)

  return `https://wa.me/${phoneWithCountry}?text=${message}`
}

export function OrdersPage() {
  const tenant = useTenant()
  const [orders, setOrders] = useState<Order[]>([])
  const savingRef = useRef(false)
  const changeVersion = useRef(0)
  const [selected, setSelected] = useState<Order | null>(null)
  const location = useLocation()
  const focusOrderId = (location.state as { orderId?: number } | null)?.orderId
  const focusedKey = useRef<string | null>(null)
  const detailsRef = useRef<HTMLDivElement>(null)
  const [draggedOrderId, setDraggedOrderId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<ColumnTitle | null>(null)
  const [dropTargetOrderId, setDropTargetOrderId] = useState<number | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [courierDialog, setCourierDialog] = useState<{ orderId: number; name: string; phone: string; choice: string; url: string | null; busy: boolean } | null>(null)
  const [knownCouriers, setKnownCouriers] = useState<string[]>([])
  const [registeredCouriers, setRegisteredCouriers] = useState<Courier[]>([])
  const [orderForm, setOrderForm] = useState<OrderFormValues>({ customer: '', phone: '', address: '', tableNumber: '', payment: 'Pix', notes: '' })
  const [products, setProducts] = useState<Product[]>([])
  const [orderItems, setOrderItems] = useState<EditableOrderItem[]>([])

  const columns = useMemo(
    () => ({
      Pendente: orders.filter((order) => order.status === 'Pendente'),
      'Em Produção': orders.filter((order) => order.status === 'Em producao'),
      'Pronto/Retirada': orders.filter((order) => order.status === 'Pronto para retirada'),
    }),
    [orders],
  )
  const enRoute = useMemo(() => orders.filter((order) => order.status === 'Saiu para entrega'), [orders])

  useEffect(() => {
    void fetchOrders()
      .then((loadedOrders) => {
        setOrders(loadedOrders)
        setSelected((current) => pickSelected(loadedOrders, current))
      })
      .catch(() => {
        toast.error('Não foi possível carregar os pedidos do backend.')
      })
  }, [])

  // vindo de uma notificação: abre o pedido indicado (uma vez por clique, para não prender a seleção)
  useEffect(() => {
    if (focusOrderId === undefined || focusedKey.current === location.key) return
    const target = orders.find((order) => order.id === focusOrderId)
    if (!target) return
    focusedKey.current = location.key
    setSelected(target)
  }, [focusOrderId, location.key, orders])

  useEffect(() => {
    void fetchProducts()
      .then(setProducts)
      .catch(() => {
        toast.error('Não foi possível carregar os itens do cardápio.')
      })
  }, [])

  usePolling(() => {
    if (savingRef.current || isEditOpen || draggedOrderId !== null) return
    const version = changeVersion.current
    return fetchOrders()
      .then((loadedOrders) => {
        // descarta a resposta se o usuário mexeu em algo enquanto ela estava a caminho
        if (savingRef.current || version !== changeVersion.current) return
        setOrders(loadedOrders)
        setSelected((current) => pickSelected(loadedOrders, current))
      })
      .catch(() => undefined)
  })

  const orderItemsSubtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const editDeliveryFee = selected?.deliveryFee ?? defaultDeliveryFee(selected?.source)
  const editTotal = orderItemsSubtotal + editDeliveryFee

  const persistOrders = (nextOrders: Order[], nextSelected: Order) => {
    changeVersion.current += 1
    savingRef.current = true
    setOrders(nextOrders)
    setSelected(nextSelected)

    void saveOrdersKeepingNew(nextOrders)
      .then((merged) => {
        if (merged.length !== nextOrders.length) setOrders(merged)
      })
      .catch((error) => {
        toast.error(error instanceof ProductUnavailableError
          ? `Sem ingrediente para: ${error.products.join(', ')}.`
          : 'Pedidos atualizados localmente, mas o backend falhou ao salvar.')
      })
      .finally(() => {
        savingRef.current = false
      })
  }

  // escolhe um pedido da busca (pode estar fora das colunas) e leva o painel de detalhes para a vista
  const handleSelectFromSearch = (order: Order) => {
    setSelected(order)
    requestAnimationFrame(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }))
  }

  const handleTogglePaid = () => {
    if (!selected) return
    const { id, paid: wasPaid } = selected
    const paid = !wasPaid
    const apply = (value: boolean) => {
      setOrders((current) => current.map((order) => order.id === id ? { ...order, paid: value } : order))
      setSelected((current) => current && current.id === id ? { ...current, paid: value } : current)
    }
    changeVersion.current += 1 // descarta a resposta de uma consulta que estava a caminho
    apply(paid)
    void setOrderPaid(id, paid)
      .then(() => toast.success(paid ? `Pagamento do pedido #${id} confirmado.` : `Confirmação do pedido #${id} desfeita.`))
      .catch(() => {
        apply(Boolean(wasPaid))
        toast.error('Não foi possível salvar a confirmação do pagamento. Tente de novo.')
      })
  }

  const handleAdvance = () => {
    if (!selected) return
    // em rota, só o entregador finaliza (pelo link dele); pedidos já entregues não avançam
    if (selected.status === 'Saiu para entrega' || selected.status === 'Entregue') return
    const nextStatus: OrderStatus =
      selected.status === 'Pendente'
        ? 'Em producao'
        : selected.status === 'Em producao'
          ? 'Pronto para retirada'
          : 'Entregue'
    const updatedSelected = {
      ...selected,
      status: nextStatus,
    }

    const nextOrders = orders.map((order) =>
        order.id === selected.id
          ? {
              ...order,
              status: nextStatus,
            }
          : order,
    )

    persistOrders(nextOrders, updatedSelected)

    toast.success('Status do pedido atualizado com sucesso.')
  }

  const resetDragState = () => {
    setDraggedOrderId(null)
    setDropTarget(null)
    setDropTargetOrderId(null)
  }

  const handleMoveOrder = (orderId: number, column: ColumnTitle, targetOrderId?: number) => {
    const nextStatus = COLUMN_STATUS[column]
    const currentOrder = orders.find((order) => order.id === orderId)

    if (!currentOrder || targetOrderId === orderId) {
      resetDragState()
      return
    }

    const movedToAnotherColumn = currentOrder.status !== nextStatus
    const movedWithinColumn = currentOrder.status === nextStatus && targetOrderId !== undefined

    if (!movedToAnotherColumn && !movedWithinColumn) {
      resetDragState()
      return
    }

    const draggedOrder = orders.find((order) => order.id === orderId)
    if (!draggedOrder) {
      resetDragState()
      return
    }

    const remainingOrders = orders.filter((order) => order.id !== orderId)
    const reorderedOrder = { ...draggedOrder, status: nextStatus }

    if (targetOrderId !== undefined) {
      const targetIndex = remainingOrders.findIndex((order) => order.id === targetOrderId)

      if (targetIndex >= 0) {
        remainingOrders.splice(targetIndex, 0, reorderedOrder)
      } else {
        remainingOrders.push(reorderedOrder)
      }
    } else {
      remainingOrders.push(reorderedOrder)
    }

    const updatedOrder = {
      ...currentOrder,
      status: nextStatus,
    }

    const nextOrders = remainingOrders
    const nextSelected = selected?.id === orderId ? updatedOrder : selected

    persistOrders(nextOrders, nextSelected)
    resetDragState()

    if (movedToAnotherColumn) {
      toast.success(`Pedido #${orderId} movido para ${column}.`)
    }
  }

  const handleDragStart = (orderId: number) => {
    setDraggedOrderId(orderId)
  }

  const handleDragEnd = () => {
    resetDragState()
  }

  const openEditOrderForm = () => {
    if (!selected || (selected.status !== 'Pendente' && selected.status !== 'Em producao')) {
      return
    }

    setOrderForm(getOrderFormValues(selected))
    setOrderItems(getOrderItemsFromMenu(selected, products))
    setIsEditOpen(true)
  }

  const addProductToOrder = (product: Product) => {
    setOrderItems((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) {
        return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }

      return [...current, { id: product.id, name: product.name, price: product.price, quantity: 1 }]
    })
  }

  const updateOrderItemQuantity = (id: string, amount: number) => {
    setOrderItems((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item))
  }

  const removeOrderItem = (id: string) => {
    setOrderItems((current) => current.filter((item) => item.id !== id))
  }

  const handleSendCourier = () => {
    if (!selected) return
    setCourierDialog({ orderId: selected.id, name: '', phone: '', choice: '', url: null, busy: false })
    void fetchCouriers().then((list) => setRegisteredCouriers(list.filter((courier) => courier.active))).catch(() => setRegisteredCouriers([]))
    // lista de entregadores já usados (só gerente/administrador consegue ler; para os outros fica vazia)
    void fetchDeliveries(new Date().toISOString()).then((result) => setKnownCouriers(result.couriers)).catch(() => undefined)
  }

  const chooseCourier = (choice: string) => {
    setCourierDialog((current) => {
      if (!current) return current
      const courier = registeredCouriers.find((item) => String(item.id) === choice)
      return courier
        ? { ...current, choice, name: courier.name, phone: courier.phone }
        : { ...current, choice, name: '', phone: '' }
    })
  }

  const generateCourierLink = async () => {
    if (!courierDialog) return
    setCourierDialog({ ...courierDialog, busy: true })
    try {
      const url = getCourierUrl(await createCourierLink(courierDialog.orderId, courierDialog.name))
      setCourierDialog((current) => current && { ...current, url, busy: false })
    } catch (error) {
      setCourierDialog((current) => current && { ...current, busy: false })
      toast.error(courierLinkErrorMessage(error))
    }
  }

  const copyCourierLink = async () => {
    if (!courierDialog?.url) return
    try {
      await navigator.clipboard.writeText(courierDialog.url)
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie o link manualmente.')
    }
  }

  const handleOpenWhatsapp = () => {
    if (!selected) return
    window.open(getWhatsappUrl(selected, tenant.slug ?? getTenantId()), '_blank', 'noopener,noreferrer')
  }

  const handleSaveOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!selected) return

    const customer = orderForm.customer.trim()
    const phone = orderForm.phone.trim()
    const address = orderForm.address.trim()
    const tableNumber = orderForm.tableNumber.trim()
    const notes = orderForm.notes.trim()

    if (!customer || !phone || orderItems.length === 0) {
      toast.error('Preencha cliente, telefone e adicione ao menos um item do cardápio.')
      return
    }

    if (resolveOrderSource(selected.source) === 'Online' && !address) {
      toast.error('Informe o endereço do pedido online.')
      return
    }

    if (selected.source === 'Mesa' && !tableNumber) {
      toast.error('Informe a mesa do pedido.')
      return
    }

    const updatedSelected: Order = {
      ...selected,
      customer,
      phone,
      address,
      tableNumber: selected.source === 'Mesa' ? tableNumber : undefined,
      items: orderItems.map((item) => item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name),
      value: editTotal,
      payment: orderForm.payment,
      notes: notes || undefined,
    }

    persistOrders(orders.map((order) => (order.id === selected.id ? updatedSelected : order)), updatedSelected)
    setIsEditOpen(false)
    toast.success('Pedido atualizado com sucesso.')
  }

  return (
    <AdminLayout title="Gestão de Pedidos" description="Acompanhe a fila operacional e avance a produção com poucos cliques.">
      <div className="mb-6 rounded-2xl border border-sa-border bg-sa-surface p-5 shadow-sa">
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(columns).map(([label, list]) => (
            <div key={label} className="rounded-2xl border border-sa-border bg-sa-surface px-4 py-3 shadow-sa">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sa-soft">{label}</p>
              <p className="mt-1 font-heading text-2xl font-bold text-sa-text">{list.length}</p>
            </div>
          ))}
          <div className="rounded-2xl border border-sa-border bg-sa-surface px-4 py-3 shadow-[0_8px_18px_rgba(14,165,233,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-sa-soft">Em rota</p>
            <p className="mt-1 font-heading text-2xl font-bold text-sa-text">{enRoute.length}</p>
          </div>
        </div>
      </div>
      <OrderSearch orders={orders} onSelect={handleSelectFromSearch} />
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-3">
          <OrderColumn
            title="Pendente"
            orders={columns.Pendente}
            selectedId={selected?.id}
            draggedOrderId={draggedOrderId}
            isDropTarget={dropTarget === 'Pendente'}
            dropTargetOrderId={dropTargetOrderId}
            onSelect={setSelected}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragEnter={() => setDropTarget('Pendente')}
            onDragLeave={() => setDropTarget((current) => (current === 'Pendente' && dropTargetOrderId === null ? null : current))}
            onDragOverOrder={setDropTargetOrderId}
            onDropOrder={handleMoveOrder}
          />
          <OrderColumn
            title="Em Produção"
            orders={columns['Em Produção']}
            selectedId={selected?.id}
            draggedOrderId={draggedOrderId}
            isDropTarget={dropTarget === 'Em Produção'}
            dropTargetOrderId={dropTargetOrderId}
            onSelect={setSelected}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragEnter={() => setDropTarget('Em Produção')}
            onDragLeave={() => setDropTarget((current) => (current === 'Em Produção' && dropTargetOrderId === null ? null : current))}
            onDragOverOrder={setDropTargetOrderId}
            onDropOrder={handleMoveOrder}
          />
          <OrderColumn
            title="Pronto/Retirada"
            orders={columns['Pronto/Retirada']}
            selectedId={selected?.id}
            draggedOrderId={draggedOrderId}
            isDropTarget={dropTarget === 'Pronto/Retirada'}
            dropTargetOrderId={dropTargetOrderId}
            onSelect={setSelected}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onDragEnter={() => setDropTarget('Pronto/Retirada')}
            onDragLeave={() => setDropTarget((current) => (current === 'Pronto/Retirada' && dropTargetOrderId === null ? null : current))}
            onDragOverOrder={setDropTargetOrderId}
            onDropOrder={handleMoveOrder}
          />
        </div>
        {enRoute.length > 0 ? (
          <section className="rounded-2xl border border-sa-border bg-sa-info-soft  p-4 shadow-sa">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="font-heading text-lg font-bold text-sa-text">Em rota</h3>
              <span className="rounded-full border border-sa-border bg-sa-surface px-3 py-1 text-xs font-semibold text-sa-info">{enRoute.length}</span>
            </div>
            <p className="mb-3 text-xs text-sa-muted">Saíram para entrega. Quem finaliza é o entregador; pelo painel ao lado você pode gerar um novo link.</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {enRoute.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  active={selected?.id === order.id}
                  locked
                  onClick={() => setSelected(order)}
                  onDragStart={() => undefined}
                  onDragEnd={() => undefined}
                  onDragEnter={() => undefined}
                  onDrop={() => undefined}
                />
              ))}
            </div>
          </section>
        ) : null}
        </div>
        <div ref={detailsRef}>
          {selected ? (
            <OrderDetailsPanel order={selected} onAdvance={handleAdvance} onEdit={openEditOrderForm} onOpenWhatsapp={handleOpenWhatsapp} onSendCourier={handleSendCourier} onTogglePaid={handleTogglePaid} />
          ) : (
            <div className="rounded-2xl border border-sa-border bg-sa-surface p-6 text-center text-sm text-sa-muted">Nenhum pedido em aberto. Os novos pedidos aparecem aqui; para ver os anteriores, use a busca.</div>
          )}
        </div>
      </div>
      <Dialog open={courierDialog !== null} onOpenChange={(open) => { if (!open) setCourierDialog(null) }}>
        <DialogContent className="max-w-md">
          <div className="grid gap-5">
          <h3 className="pr-8 font-heading text-2xl font-bold text-sa-text">Entregador do pedido #{courierDialog?.orderId}</h3>
          {courierDialog?.url === null ? (
            <>
              <p className="text-sm leading-6 text-sa-muted">Informe quem vai entregar (opcional) para acompanhar na tela de Entregas.</p>
              {registeredCouriers.length > 0 ? (
                <select value={courierDialog.choice} onChange={(event) => chooseCourier(event.target.value)} aria-label="Entregador" className="h-11 w-full rounded-2xl border border-sa-border bg-sa-surface px-4 text-sm text-sa-text outline-none focus:border-sa-accent focus:ring-4 focus:ring-sa-accent/20">
                  <option value="">Escolha o entregador</option>
                  {registeredCouriers.map((courier) => <option key={courier.id} value={courier.id}>{courier.name}</option>)}
                  <option value="other">Outro (digitar o nome)</option>
                </select>
              ) : null}
              {registeredCouriers.length === 0 || courierDialog.choice === 'other' ? (
                <>
                  <Input list="known-couriers" value={courierDialog.name} maxLength={60} onChange={(event) => setCourierDialog({ ...courierDialog, name: event.target.value })} placeholder="Nome do entregador" />
                  <datalist id="known-couriers">{knownCouriers.map((name) => <option key={name} value={name} />)}</datalist>
                </>
              ) : null}
              {registeredCouriers.length === 0 ? <p className="-mt-2 text-xs text-sa-muted">Dica: cadastre seus entregadores em Configurações → Entregadores para escolher da lista e enviar direto pelo WhatsApp.</p> : null}
              <Button onClick={() => void generateCourierLink()} disabled={courierDialog.busy}>{courierDialog.busy ? 'Gerando...' : 'Gerar link'}</Button>
            </>
          ) : (
            <>
              <p className="text-sm leading-6 text-sa-muted">Envie ao entregador: ele abre o link no celular e toca em &quot;Iniciar entrega&quot;. Um novo link invalida o anterior.</p>
              <Input readOnly value={courierDialog?.url ?? ''} onFocus={(event) => event.currentTarget.select()} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Button variant="outline" onClick={() => void copyCourierLink()}>Copiar link</Button>
                <Button onClick={() => { if (courierDialog?.url) window.open(`https://wa.me/${whatsappNumber(courierDialog.phone)}?text=${encodeURIComponent(`Entrega do pedido #${courierDialog.orderId}: ${courierDialog.url}`)}`, '_blank', 'noopener,noreferrer') }}>{courierDialog?.phone ? `Enviar para ${courierDialog.name}` : 'Enviar pelo WhatsApp'}</Button>
              </div>
            </>
          )}
          </div>
        </DialogContent>
      </Dialog>
      {selected && <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto">
          <form onSubmit={handleSaveOrder} className="grid gap-4">
            <div>
              <h3 className="font-heading text-2xl font-bold text-sa-text">Editar pedido #{selected.id}</h3>
              <p className="mt-2 text-sm text-sa-muted">Atualize os dados principais antes de avançar o pedido na operação.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-sa-text-2">
                Cliente
                <Input value={orderForm.customer} onChange={(event) => setOrderForm((current) => ({ ...current, customer: event.target.value }))} placeholder="Nome do cliente" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-sa-text-2">
                Telefone
                <Input value={orderForm.phone} onChange={(event) => setOrderForm((current) => ({ ...current, phone: event.target.value }))} placeholder="(11) 99999-9999" inputMode="tel" />
              </label>
              {resolveOrderSource(selected.source) === 'Mesa' ? (
                <label className="grid gap-2 text-sm font-semibold text-sa-text-2">
                  Mesa
                  <Input value={orderForm.tableNumber} onChange={(event) => setOrderForm((current) => ({ ...current, tableNumber: event.target.value }))} placeholder="Ex: 12" />
                </label>
              ) : resolveOrderSource(selected.source) === 'Online' ? (
                <label className="grid gap-2 text-sm font-semibold text-sa-text-2 md:col-span-2">
                  Endereço
                  <Input value={orderForm.address} onChange={(event) => setOrderForm((current) => ({ ...current, address: event.target.value }))} placeholder="Rua, número e complemento" />
                </label>
              ) : null}
              <label className="grid gap-2 text-sm font-semibold text-sa-text-2">
                Pagamento
                <select value={orderForm.payment} onChange={(event) => setOrderForm((current) => ({ ...current, payment: event.target.value as Order['payment'] }))} className="h-11 rounded-2xl border border-sa-border bg-sa-surface px-4 text-sm text-sa-text outline-none focus:border-sa-accent focus:ring-4 focus:ring-sa-accent/20">
                  <option value="Pix">Pix</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <p className="text-sm font-semibold text-sa-text-2">Itens do pedido</p>
                <div className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded-xl border border-sa-border bg-sa-surface p-3">
                  {orderItems.length === 0 ? <p className="py-4 text-center text-sm text-sa-soft">Nenhum item selecionado.</p> : null}
                  {orderItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-sa-border bg-sa-surface p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-sa-text">{item.name}</p>
                          <p className="mt-1 font-mono text-sm text-sa-muted">{formatCurrency(item.price)}</p>
                        </div>
                        <button type="button" onClick={() => removeOrderItem(item.id)} className="text-sm font-semibold text-sa-accent-text">Remover</button>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button type="button" variant="outline" className="h-9 w-9 px-0" onClick={() => updateOrderItemQuantity(item.id, -1)}>-</Button>
                        <span className="min-w-8 text-center font-mono font-semibold">{item.quantity}</span>
                        <Button type="button" variant="outline" className="h-9 w-9 px-0" onClick={() => updateOrderItemQuantity(item.id, 1)}>+</Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2 rounded-xl border border-sa-border bg-sa-surface-2 p-4 text-sm text-sa-text-2">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(orderItemsSubtotal)}</span></div>
                  <div className="flex justify-between"><span>{resolveOrderSource(selected.source) === 'Online' ? 'Taxa de entrega' : 'Taxa'}</span><span className="font-mono">{formatCurrency(editDeliveryFee)}</span></div>
                  <div className="flex justify-between text-base font-semibold text-sa-text"><span>Total</span><span className="font-mono">{formatCurrency(editTotal)}</span></div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-sa-text-2">Cardápio</p>
                <div className="mt-2 max-h-80 space-y-2 overflow-y-auto rounded-xl border border-sa-border bg-sa-surface p-3">
                  {products.filter((product) => product.available).map((product) => (
                    <button key={product.id} type="button" onClick={() => addProductToOrder(product)} className="w-full rounded-2xl border border-sa-border bg-sa-surface p-3 text-left transition hover:border-sa-border-strong hover:bg-sa-hover">
                      <span className="block font-semibold text-sa-text">{product.name}</span>
                      <span className="mt-1 block font-mono text-sm text-sa-muted">{formatCurrency(product.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-sa-text-2">
              Observação
              <textarea value={orderForm.notes} onChange={(event) => setOrderForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ex: sem cebola, sem molho, sem salada" className="min-h-24 rounded-2xl border border-sa-border bg-sa-surface px-4 py-3 text-sm text-sa-text outline-none transition-all duration-200 placeholder:text-sa-soft focus:border-sa-accent focus:ring-4 focus:ring-sa-accent/20" />
            </label>
            <div className="sticky bottom-0 -mx-6 flex justify-end gap-3 border-t border-sa-border bg-sa-surface px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar pedido</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>}
    </AdminLayout>
  )
}
