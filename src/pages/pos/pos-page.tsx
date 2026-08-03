import { useEffect, useMemo, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { SearchInput } from '@/components/shared/search-input'
import { CategoryTabs } from '@/components/pos/category-tabs'
import { posCategories, products as initialProducts, type Product } from '@/data/mock-products'
import { ProductCard } from '@/components/pos/product-card'
import { CartPanel } from '@/components/pos/cart-panel'
import { Button } from '@/components/ui/button'
import { MobileDrawer } from '@/components/shared/mobile-drawer'
import { fetchOrders, saveOrders } from '@/lib/orders-api'
import { fetchCategories, fetchProducts } from '@/lib/catalog-api'
import type { Order } from '@/data/mock-orders'

type CartItem = { id: string; name: string; price: number; quantity: number }
type OrderSource = 'Mesa' | 'Online'
const productsPerPage = 9

export function PosPage() {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [products, setProducts] = useState<Product[]>(initialProducts)
  const [categories, setCategories] = useState<string[]>(['Todas', ...posCategories])
  const [category, setCategory] = useState<string>('Todas')
  const [paymentMethod, setPaymentMethod] = useState<'Pix' | 'Cartão' | 'Dinheiro'>('Pix')
  const [orderSource, setOrderSource] = useState<OrderSource>('Mesa')
  const [tableNumber, setTableNumber] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    void Promise.all([fetchProducts(), fetchCategories()])
      .then(([loadedProducts, loadedCategories]) => {
        const availableProducts = loadedProducts.filter((product) => product.available)
        const availableCategories = loadedCategories
          .filter((item) => item.posEnabled && availableProducts.some((product) => product.category === item.name))
          .map((item) => item.name)
        const nextCategories = ['Todas', ...availableCategories]

        setProducts(availableProducts)
        setCategories(nextCategories)
        setCategory((current) => nextCategories.includes(current) ? current : 'Todas')
      })
      .catch(() => {
        toast.error('Não foi possível carregar os itens do cardápio.')
      })
  }, [])

  const filteredProducts = useMemo(
    () => products.filter((product) => (category === 'Todas' || product.category === category) && product.name.toLowerCase().includes(query.toLowerCase())),
    [products, category, query],
  )
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / productsPerPage))
  const paginatedProducts = filteredProducts.slice((currentPage - 1) * productsPerPage, currentPage * productsPerPage)
  const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0)
  const cartSubtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)

  useEffect(() => {
    setCurrentPage(1)
  }, [category, query])

  useEffect(() => {
    setCurrentPage((page) => Math.min(page, totalPages))
  }, [totalPages])

  const addToCart = (product: Product, size?: 'P' | 'M' | 'G', price?: number) => {
    const itemId = size ? `${product.id}-${size}` : product.id
    const itemName = size ? `${product.name} (${size})` : product.name
    const itemPrice = price ?? product.price

    setCart((current) => {
      const existing = current.find((item) => item.id === itemId)
      if (existing) {
        return current.map((item) => item.id === itemId ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...current, { id: itemId, name: itemName, price: itemPrice, quantity: 1 }]
    })
  }

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error('Adicione itens ao carrinho antes de finalizar.')
      return
    }

    if (orderSource === 'Mesa' && tableNumber.trim().length === 0) {
      toast.error('Informe a mesa do pedido.')
      return
    }

    if (orderSource === 'Online' && customerName.trim().length === 0) {
      toast.error('Informe o nome do cliente.')
      return
    }

    const currentOrders = await fetchOrders()
    const deliveryFee = orderSource === 'Online' ? 8 : 0
    const now = new Date()
    const newOrder: Order = {
      id: Math.max(0, ...currentOrders.map((order) => order.id)) + 1,
      customer: orderSource === 'Mesa' ? `Mesa ${tableNumber.trim()}` : customerName.trim(),
      phone: orderSource === 'Mesa' ? '-' : customerPhone.trim() || 'Não informado',
      address: orderSource === 'Mesa' ? '' : 'Pedido online',
      source: orderSource,
      tableNumber: orderSource === 'Mesa' ? tableNumber.trim() : undefined,
      deliveryFee,
      items: cart.map((item) => item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name),
      elapsed: 'agora',
      value: cartSubtotal + deliveryFee,
      status: 'Pendente',
      payment: paymentMethod,
      notes: notes.trim() || undefined,
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
    }

    await saveOrders([newOrder, ...currentOrders])
    const orderTarget = orderSource === 'Mesa' ? `Mesa ${tableNumber.trim()}` : 'Online'
    toast.success(`Pedido ${orderTarget} enviado para a fila.`)
    setCart([])
    setTableNumber('')
    setCustomerName('')
    setCustomerPhone('')
    setNotes('')
    navigate('/orders')
  }

  return (
    <AdminLayout title="PDV Operacional" description="Busca rápida, categorias visíveis e carrinho pronto para atendimento ágil.">
      <div className="mb-6 rounded-[30px] border border-orange-100 bg-gradient-to-r from-[#fffaf5] to-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Operação</p>
            <p className="mt-1 font-heading text-2xl font-bold text-slate-900">Monte pedidos com agilidade</p>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-white/90 px-4 py-3 shadow-[0_8px_18px_rgba(255,107,0,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Itens no carrinho</p>
            <p className="mt-1 font-heading text-2xl font-bold text-slate-900">{cartQuantity}</p>
          </div>
          <div className="rounded-2xl border border-orange-200 bg-white/90 px-4 py-3 shadow-[0_8px_18px_rgba(255,107,0,0.06)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Subtotal</p>
            <p className="mt-1 font-heading text-2xl font-bold text-slate-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cartSubtotal)}</p>
          </div>
        </div>
      </div>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3">
            <div className="flex-1"><SearchInput placeholder="Buscar produto" value={query} onChange={(event) => setQuery(event.target.value)} /></div>
            <div className="xl:hidden">
              <MobileDrawer side="bottom" trigger={<Button><ShoppingCart className="mr-2 h-4 w-4" />Carrinho</Button>}>
                <div className="h-full p-4">
                  <CartPanel
                    items={cart}
                    paymentMethod={paymentMethod}
                    orderSource={orderSource}
                    tableNumber={tableNumber}
                    customerName={customerName}
                    customerPhone={customerPhone}
                    notes={notes}
                    onPaymentChange={setPaymentMethod}
                    onOrderSourceChange={setOrderSource}
                    onTableNumberChange={setTableNumber}
                    onCustomerNameChange={setCustomerName}
                    onCustomerPhoneChange={setCustomerPhone}
                    onNotesChange={setNotes}
                    onUpdateQuantity={(id, amount) => setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item))}
                    onRemove={(id) => setCart((current) => current.filter((item) => item.id !== id))}
                    onClear={() => setCart([])}
                    onCheckout={handleCheckout}
                  />
                </div>
              </MobileDrawer>
            </div>
            </div>
            <div className="mt-4"><CategoryTabs categories={categories} value={category} onChange={setCategory} /></div>
          </div>
          <div className="mt-6 flex flex-col gap-3 rounded-[24px] border border-orange-100 bg-white/80 p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-slate-600">Mostrando {paginatedProducts.length} de {filteredProducts.length} produto(s)</p>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" disabled={currentPage === 1} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}>Anterior</Button>
              <span className="rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-sm font-semibold text-orange-700">{currentPage} / {totalPages}</span>
              <Button type="button" variant="outline" disabled={currentPage === totalPages} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}>Próxima</Button>
            </div>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {paginatedProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={(size, price) => addToCart(product, size, price)} />)}
            {paginatedProducts.length === 0 ? <div className="col-span-full rounded-[28px] border border-dashed border-orange-200 bg-orange-50/60 p-8 text-center text-sm font-semibold text-slate-500">Nenhum produto encontrado.</div> : null}
          </div>
        </div>
        <div className="hidden xl:block">
          <CartPanel
            items={cart}
            paymentMethod={paymentMethod}
            orderSource={orderSource}
            tableNumber={tableNumber}
            customerName={customerName}
            customerPhone={customerPhone}
            notes={notes}
            onPaymentChange={setPaymentMethod}
            onOrderSourceChange={setOrderSource}
            onTableNumberChange={setTableNumber}
            onCustomerNameChange={setCustomerName}
            onCustomerPhoneChange={setCustomerPhone}
            onNotesChange={setNotes}
            onUpdateQuantity={(id, amount) => setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item))}
            onRemove={(id) => setCart((current) => current.filter((item) => item.id !== id))}
            onClear={() => setCart([])}
            onCheckout={handleCheckout}
          />
        </div>
      </div>
    </AdminLayout>
  )
}
