import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { OrderColumn } from '@/components/orders/order-column'
import { OrderDetailsPanel } from '@/components/orders/order-details-panel'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/formatters'
import { orders as mockOrders, type Order, type OrderStatus } from '@/data/mock-orders'
import { fetchProducts, saveProducts } from '@/lib/catalog-api'
import { products as initialProducts, type Product } from '@/data/mock-products'
import { fetchOrders, saveOrders } from '@/lib/orders-api'
import { fetchInventory, saveInventory, type InventoryItem } from '@/lib/inventory-api'
import { getTenantId } from '@/lib/tenant-storage'
import { getPublicOrderTrackingUrl } from '@/lib/public-order-url'

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

function getWhatsappUrl(order: Order) {
  const phone = order.phone.replace(/\D/g, '')
  const phoneWithCountry = phone.startsWith('55') ? phone : `55${phone}`
  const trackingUrl = getPublicOrderTrackingUrl(getTenantId(), order.id)
  const message = encodeURIComponent(`Olá, ${order.customer}! Acompanhe o seu pedido #${order.id}: ${trackingUrl}`)

  return `https://wa.me/${phoneWithCountry}?text=${message}`
}

function normalizeName(value: string) {
  return value.replace(/\s+\([PMG]\)$/i, '').trim().toLocaleLowerCase('pt-BR')
}

function parseOrderItem(item: string) {
  const match = item.match(/^(\d+)x\s+(.+)$/)

  return {
    quantity: match ? Number(match[1]) : 1,
    name: match ? match[2] : item,
  }
}

function syncProductsWithInventory(nextProducts: Product[], inventoryItems: InventoryItem[]) {
  return nextProducts.map((product) => {
    const relatedItems = inventoryItems.filter((item) => item.linkedProductId === product.id || item.usedInProductIds?.includes(product.id))

    if (relatedItems.length === 0) {
      return product
    }

    return {
      ...product,
      available: !relatedItems.some((item) => item.quantity <= item.minQuantity),
    }
  })
}

export function OrdersPage() {
  const [orders, setOrders] = useState(mockOrders)
  const [selected, setSelected] = useState<Order>(mockOrders[0])
  const [draggedOrderId, setDraggedOrderId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<ColumnTitle | null>(null)
  const [dropTargetOrderId, setDropTargetOrderId] = useState<number | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [orderForm, setOrderForm] = useState<OrderFormValues>(() => getOrderFormValues(mockOrders[0]))
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [orderItems, setOrderItems] = useState<EditableOrderItem[]>(() => getOrderItemsFromMenu(mockOrders[0], initialProducts))

  const columns = useMemo(
    () => ({
      Pendente: orders.filter((order) => order.status === 'Pendente'),
      'Em Produção': orders.filter((order) => order.status === 'Em producao'),
      'Pronto/Retirada': orders.filter((order) => order.status === 'Pronto para retirada'),
    }),
    [orders],
  )

  useEffect(() => {
    void fetchOrders()
      .then((loadedOrders) => {
        if (loadedOrders.length === 0) {
          return
        }

        setOrders(loadedOrders)
        setSelected((current) => loadedOrders.find((order) => order.id === current.id) ?? loadedOrders[0])
      })
      .catch(() => {
        toast.error('Não foi possível carregar os pedidos do backend.')
      })
  }, [])

  useEffect(() => {
    void fetchProducts()
      .then(setProducts)
      .catch(() => {
        toast.error('Não foi possível carregar os itens do cardápio.')
      })
  }, [])

  const orderItemsSubtotal = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const editDeliveryFee = selected.deliveryFee ?? ((selected.source ?? 'Online') === 'Online' ? 8 : 0)
  const editTotal = orderItemsSubtotal + editDeliveryFee

  const persistOrders = (nextOrders: Order[], nextSelected: Order) => {
    setOrders(nextOrders)
    setSelected(nextSelected)

    void saveOrders(nextOrders).catch(() => {
      toast.error('Pedidos atualizados localmente, mas o backend falhou ao salvar.')
    })
  }

  const deductInventoryForOrder = async (order: Order) => {
    const inventoryItems = await fetchInventory()
    const productByName = new Map(products.map((product) => [normalizeName(product.name), product]))
    const quantitiesByProductId = new Map<string, number>()

    for (const item of order.items) {
      const parsed = parseOrderItem(item)
      const product = productByName.get(normalizeName(parsed.name))

      if (product) {
        quantitiesByProductId.set(product.id, (quantitiesByProductId.get(product.id) ?? 0) + parsed.quantity)
      }
    }

    if (quantitiesByProductId.size === 0) {
      return 0
    }

    let deductedItems = 0
    const nextInventory = inventoryItems.map((item) => {
      const relatedProductIds = [item.linkedProductId, ...(item.usedInProductIds ?? [])].filter(Boolean) as string[]
      const deduction = relatedProductIds.reduce((sum, productId) => sum + (quantitiesByProductId.get(productId) ?? 0), 0)

      if (deduction <= 0) {
        return item
      }

      deductedItems += 1
      return { ...item, quantity: Math.max(0, item.quantity - deduction) }
    })

    await saveInventory(nextInventory)

    const nextProducts = syncProductsWithInventory(products, nextInventory)
    setProducts(nextProducts)
    await saveProducts(nextProducts)

    return deductedItems
  }

  const handleAdvance = async () => {
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

    if (selected.status !== 'Entregue' && nextStatus === 'Entregue') {
      try {
        const deductedItems = await deductInventoryForOrder(selected)
        if (deductedItems > 0) {
          toast.success('Estoque baixado automaticamente.')
        }
      } catch {
        toast.error('Pedido finalizado, mas não foi possível baixar o estoque.')
      }
    }

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
    const nextSelected = selected.id === orderId ? updatedOrder : selected

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
    if (selected.status !== 'Pendente' && selected.status !== 'Em producao') {
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

  const handleOpenWhatsapp = () => {
    window.open(getWhatsappUrl(selected), '_blank', 'noopener,noreferrer')
  }

  const handleSaveOrder = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const customer = orderForm.customer.trim()
    const phone = orderForm.phone.trim()
    const address = orderForm.address.trim()
    const tableNumber = orderForm.tableNumber.trim()
    const notes = orderForm.notes.trim()

    if (!customer || !phone || orderItems.length === 0) {
      toast.error('Preencha cliente, telefone e adicione ao menos um item do cardápio.')
      return
    }

    if ((selected.source ?? 'Online') === 'Online' && !address) {
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
      <div className="mb-6 rounded-[30px] border border-orange-100 bg-gradient-to-r from-[#fffaf5] to-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(columns).map(([label, list]) => (
            <div key={label} className="rounded-2xl border border-orange-200 bg-white/90 px-4 py-3 shadow-[0_8px_18px_rgba(255,107,0,0.06)]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
              <p className="mt-1 font-heading text-2xl font-bold text-slate-900">{list.length}</p>
            </div>
          ))}
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid gap-4 lg:grid-cols-3">
          <OrderColumn
            title="Pendente"
            orders={columns.Pendente}
            selectedId={selected.id}
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
            selectedId={selected.id}
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
            selectedId={selected.id}
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
        <div>
          <OrderDetailsPanel order={selected} onAdvance={handleAdvance} onEdit={openEditOrderForm} onOpenWhatsapp={handleOpenWhatsapp} />
        </div>
      </div>
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-2xl overflow-y-auto">
          <form onSubmit={handleSaveOrder} className="grid gap-4">
            <div>
              <h3 className="font-heading text-2xl font-bold text-slate-900">Editar pedido #{selected.id}</h3>
              <p className="mt-2 text-sm text-slate-500">Atualize os dados principais antes de avançar o pedido na operação.</p>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Cliente
                <Input value={orderForm.customer} onChange={(event) => setOrderForm((current) => ({ ...current, customer: event.target.value }))} placeholder="Nome do cliente" />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Telefone
                <Input value={orderForm.phone} onChange={(event) => setOrderForm((current) => ({ ...current, phone: event.target.value }))} placeholder="(11) 99999-9999" inputMode="tel" />
              </label>
              {(selected.source ?? 'Online') === 'Mesa' ? (
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Mesa
                  <Input value={orderForm.tableNumber} onChange={(event) => setOrderForm((current) => ({ ...current, tableNumber: event.target.value }))} placeholder="Ex: 12" />
                </label>
              ) : (
                <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">
                  Endereço
                  <Input value={orderForm.address} onChange={(event) => setOrderForm((current) => ({ ...current, address: event.target.value }))} placeholder="Rua, número e complemento" />
                </label>
              )}
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Pagamento
                <select value={orderForm.payment} onChange={(event) => setOrderForm((current) => ({ ...current, payment: event.target.value as Order['payment'] }))} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
                  <option value="Pix">Pix</option>
                  <option value="Cartão">Cartão</option>
                  <option value="Dinheiro">Dinheiro</option>
                </select>
              </label>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div>
                <p className="text-sm font-semibold text-slate-700">Itens do pedido</p>
                <div className="mt-2 max-h-72 space-y-2 overflow-y-auto rounded-[24px] border border-orange-100 bg-white/80 p-3">
                  {orderItems.length === 0 ? <p className="py-4 text-center text-sm text-slate-400">Nenhum item selecionado.</p> : null}
                  {orderItems.map((item) => (
                    <div key={item.id} className="rounded-2xl border border-orange-100 bg-white p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">{item.name}</p>
                          <p className="mt-1 font-mono text-sm text-slate-500">{formatCurrency(item.price)}</p>
                        </div>
                        <button type="button" onClick={() => removeOrderItem(item.id)} className="text-sm font-semibold text-orange-700">Remover</button>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <Button type="button" variant="outline" className="h-9 w-9 px-0" onClick={() => updateOrderItemQuantity(item.id, -1)}>-</Button>
                        <span className="min-w-8 text-center font-mono font-semibold">{item.quantity}</span>
                        <Button type="button" variant="outline" className="h-9 w-9 px-0" onClick={() => updateOrderItemQuantity(item.id, 1)}>+</Button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 space-y-2 rounded-[24px] border border-orange-100 bg-orange-50/40 p-4 text-sm text-slate-600">
                  <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(orderItemsSubtotal)}</span></div>
                  <div className="flex justify-between"><span>{(selected.source ?? 'Online') === 'Mesa' ? 'Taxa de mesa' : 'Taxa de entrega'}</span><span className="font-mono">{formatCurrency(editDeliveryFee)}</span></div>
                  <div className="flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span className="font-mono">{formatCurrency(editTotal)}</span></div>
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">Cardápio</p>
                <div className="mt-2 max-h-80 space-y-2 overflow-y-auto rounded-[24px] border border-orange-100 bg-white/80 p-3">
                  {products.filter((product) => product.available).map((product) => (
                    <button key={product.id} type="button" onClick={() => addProductToOrder(product)} className="w-full rounded-2xl border border-orange-100 bg-white p-3 text-left transition hover:border-orange-300 hover:bg-orange-50/50">
                      <span className="block font-semibold text-slate-900">{product.name}</span>
                      <span className="mt-1 block font-mono text-sm text-slate-500">{formatCurrency(product.price)}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">
              Observação
              <textarea value={orderForm.notes} onChange={(event) => setOrderForm((current) => ({ ...current, notes: event.target.value }))} placeholder="Ex: sem cebola, sem molho, sem salada" className="min-h-24 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100" />
            </label>
            <div className="sticky bottom-0 -mx-6 flex justify-end gap-3 border-t border-orange-100 bg-white px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>Cancelar</Button>
              <Button type="submit">Salvar pedido</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
