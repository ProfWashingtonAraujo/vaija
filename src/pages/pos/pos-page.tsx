import { useMemo, useState } from 'react'
import { ShoppingCart } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { SearchInput } from '@/components/shared/search-input'
import { CategoryTabs } from '@/components/pos/category-tabs'
import { posCategories, products } from '@/data/mock-products'
import { ProductCard } from '@/components/pos/product-card'
import { CartPanel } from '@/components/pos/cart-panel'
import { Button } from '@/components/ui/button'
import { MobileDrawer } from '@/components/shared/mobile-drawer'

type CartItem = { id: string; name: string; price: number; quantity: number }

export function PosPage() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<string>(posCategories[0])
  const [paymentMethod, setPaymentMethod] = useState<'Pix' | 'Cartao' | 'Dinheiro'>('Pix')
  const [cart, setCart] = useState<CartItem[]>([])

  const filteredProducts = useMemo(
    () => products.filter((product) => product.category === category && product.name.toLowerCase().includes(query.toLowerCase())),
    [category, query],
  )

  const addToCart = (product: (typeof products)[number]) => {
    setCart((current) => {
      const existing = current.find((item) => item.id === product.id)
      if (existing) {
        return current.map((item) => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item)
      }
      return [...current, { id: product.id, name: product.name, price: product.price, quantity: 1 }]
    })
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
            <p className="mt-1 font-heading text-2xl font-bold text-slate-900">{cart.reduce((sum, item) => sum + item.quantity, 0)}</p>
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
                    onPaymentChange={setPaymentMethod}
                    onUpdateQuantity={(id, amount) => setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item))}
                    onRemove={(id) => setCart((current) => current.filter((item) => item.id !== id))}
                    onClear={() => setCart([])}
                    onCheckout={() => { toast.success('Pedido finalizado com sucesso.'); setCart([]) }}
                  />
                </div>
              </MobileDrawer>
            </div>
            </div>
            <div className="mt-4"><CategoryTabs categories={posCategories} value={category} onChange={setCategory} /></div>
          </div>
          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {filteredProducts.map((product) => <ProductCard key={product.id} product={product} onAdd={() => addToCart(product)} />)}
          </div>
        </div>
        <div className="hidden xl:block">
          <CartPanel
            items={cart}
            paymentMethod={paymentMethod}
            onPaymentChange={setPaymentMethod}
            onUpdateQuantity={(id, amount) => setCart((current) => current.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item))}
            onRemove={(id) => setCart((current) => current.filter((item) => item.id !== id))}
            onClear={() => setCart([])}
            onCheckout={() => { toast.success('Pedido finalizado com sucesso.'); setCart([]) }}
          />
        </div>
      </div>
    </AdminLayout>
  )
}
