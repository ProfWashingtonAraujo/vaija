import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { OrderColumn } from '@/components/orders/order-column'
import { OrderDetailsPanel } from '@/components/orders/order-details-panel'
import { orders as mockOrders, type Order, type OrderStatus } from '@/data/mock-orders'
import { fetchOrders, saveOrders } from '@/lib/orders-api'

const COLUMN_STATUS = {
  Pendente: 'Pendente',
  'Em Produção': 'Em producao',
  'Pronto/Retirada': 'Pronto para retirada',
} as const

type ColumnTitle = keyof typeof COLUMN_STATUS

export function OrdersPage() {
  const [orders, setOrders] = useState(mockOrders)
  const [selected, setSelected] = useState<Order>(mockOrders[0])
  const [draggedOrderId, setDraggedOrderId] = useState<number | null>(null)
  const [dropTarget, setDropTarget] = useState<ColumnTitle | null>(null)
  const [dropTargetOrderId, setDropTargetOrderId] = useState<number | null>(null)

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
        toast.error('Nao foi possivel carregar os pedidos do backend.')
      })
  }, [])

  const persistOrders = (nextOrders: Order[], nextSelected: Order) => {
    setOrders(nextOrders)
    setSelected(nextSelected)

    void saveOrders(nextOrders).catch(() => {
      toast.error('Pedidos atualizados localmente, mas o backend falhou ao salvar.')
    })
  }

  const handleAdvance = () => {
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
          <OrderDetailsPanel order={selected} onAdvance={handleAdvance} />
        </div>
      </div>
    </AdminLayout>
  )
}
