import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { OrderColumn } from '@/components/orders/order-column'
import { OrderDetailsPanel } from '@/components/orders/order-details-panel'
import { orders as mockOrders, type Order } from '@/data/mock-orders'

export function OrdersPage() {
  const [orders, setOrders] = useState(mockOrders)
  const [selected, setSelected] = useState<Order>(mockOrders[0])

  const columns = useMemo(
    () => ({
      Pendente: orders.filter((order) => order.status === 'Pendente'),
      'Em Produção': orders.filter((order) => order.status === 'Em producao'),
      'Pronto/Retirada': orders.filter((order) => order.status === 'Pronto para retirada'),
    }),
    [orders],
  )

  const handleAdvance = () => {
    setOrders((current) =>
      current.map((order) =>
        order.id === selected.id
          ? {
              ...order,
              status:
                order.status === 'Pendente'
                  ? 'Em producao'
                  : order.status === 'Em producao'
                    ? 'Pronto para retirada'
                    : 'Entregue',
            }
          : order,
      ),
    )
    setSelected((current) => ({
      ...current,
      status:
        current.status === 'Pendente'
          ? 'Em producao'
          : current.status === 'Em producao'
            ? 'Pronto para retirada'
            : 'Entregue',
    }))
    toast.success('Status do pedido atualizado com sucesso.')
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
          <OrderColumn title="Pendente" orders={columns.Pendente} selectedId={selected.id} onSelect={setSelected} />
          <OrderColumn title="Em Produção" orders={columns['Em Produção']} selectedId={selected.id} onSelect={setSelected} />
          <OrderColumn title="Pronto/Retirada" orders={columns['Pronto/Retirada']} selectedId={selected.id} onSelect={setSelected} />
        </div>
        <div>
          <OrderDetailsPanel order={selected} onAdvance={handleAdvance} />
        </div>
      </div>
    </AdminLayout>
  )
}
