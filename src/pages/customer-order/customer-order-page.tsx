import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Download, History, Home, LogOut, ShoppingBag, Sparkles, Truck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/search-input'
import { CategoryCircles } from '@/components/menu/category-circles'
import { rebuildCartItems } from '@/lib/reorder'
import { findPublicOrders } from '@/lib/orders-api'
import type { Order } from '@/data/mock-orders'
import { formatCurrency } from '@/lib/formatters'
import { fetchPublicCategories, fetchPublicProducts } from '@/lib/catalog-api'
import type { Product } from '@/data/mock-products'
import { HalfAndHalfDialog } from '@/components/shared/half-and-half-dialog'
import { isHalfEligible } from '@/lib/half-and-half'
import { useInstallApp } from '@/lib/pwa'
import { SplashScreen } from '@/components/shared/splash-screen'
import { usePublicSettings } from '@/lib/use-public-settings'
import { cashRegisterUpdatedEvent, fetchPublicCashRegisterOpen, readCashRegister, type CashRegisterState } from '@/lib/cash-register'

type CartItem = { id: string; name: string; price: number; quantity: number }
type CustomerProfile = { name: string; email: string; phone: string; provider: 'simple' | 'google' }

const customerProfileKey = 'vaija.customerProfile'
const customerCartKey = 'vaija.customerCart'
const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: { client_id: string; callback: (response: { credential: string }) => void }) => void
          renderButton: (element: HTMLElement, options: { theme: string; size: string; width: string; text: string }) => void
        }
      }
    }
  }
}

function decodeGoogleCredential(credential: string) {
  const payload = credential.split('.')[1]
  const decoded = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as { name?: string; email?: string }
  return { name: decoded.name ?? '', email: decoded.email ?? '' }
}

function readStoredProfile() {
  const storedProfile = localStorage.getItem(customerProfileKey)
  return storedProfile ? JSON.parse(storedProfile) as CustomerProfile : null
}

function getCustomerCartKey(tenantId: string) {
  return tenantId === 'default' ? customerCartKey : `${customerCartKey}.${tenantId}`
}

function readStoredCart(tenantId: string) {
  const storedCart = localStorage.getItem(getCustomerCartKey(tenantId))
  return storedCart ? JSON.parse(storedCart) as CartItem[] : []
}

export function CustomerOrderPage() {
  const navigate = useNavigate()
  const { tenantId: routeTenantId } = useParams()
  const tenantId = routeTenantId ?? 'default'
  const orderPath = routeTenantId ? `/pedido/${encodeURIComponent(tenantId)}` : '/pedido'
  const [products, setProducts] = useState<Product[]>([])
  const [halfOpen, setHalfOpen] = useState(false)
  const [halfProduct, setHalfProduct] = useState<Product | undefined>()
  const [category, setCategory] = useState('Todos')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>(() => readStoredCart(tenantId))
  const [profile, setProfile] = useState<CustomerProfile | null>(readStoredProfile)
  const [signupName, setSignupName] = useState(profile?.name ?? '')
  const [signupEmail, setSignupEmail] = useState(profile?.email ?? '')
  const [signupPhone, setSignupPhone] = useState(profile?.phone ?? '')
  const [cashRegister, setCashRegister] = useState<CashRegisterState>({ isOpen: false })
  const [pastOrders, setPastOrders] = useState<Order[]>([])
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const { settings, ready } = usePublicSettings(tenantId)
  const { canInstall, isIos, install } = useInstallApp()

  useEffect(() => {
    setProducts([])
    void Promise.all([fetchPublicCategories(tenantId), fetchPublicProducts(tenantId)])
      .then(([loadedCategories, loadedProducts]) => {
        const publishedCategories = new Set(loadedCategories.filter((category) => category.menuEnabled).map((category) => category.name))
        setProducts(loadedProducts.filter((product) => product.available && publishedCategories.has(product.category)))
      })
      .catch(() => toast.error('Não foi possível carregar o cardápio.'))
  }, [tenantId])

  useEffect(() => {
    localStorage.setItem(getCustomerCartKey(tenantId), JSON.stringify(cart))
  }, [cart, tenantId])

  useEffect(() => {
    const updateCashRegister = (event: Event) => {
      setCashRegister((event as CustomEvent<CashRegisterState>).detail ?? readCashRegister())
    }

    window.addEventListener(cashRegisterUpdatedEvent, updateCashRegister)
    return () => window.removeEventListener(cashRegisterUpdatedEvent, updateCashRegister)
  }, [])

  useEffect(() => {
    let active = true
    const refresh = () => {
      void fetchPublicCashRegisterOpen(tenantId)
        .then((isOpen) => { if (active) setCashRegister({ isOpen }) })
        .catch(() => undefined)
    }
    refresh()
    const timer = window.setInterval(refresh, 20_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [tenantId])

  useEffect(() => {
    if (profile || !googleClientId || !googleButtonRef.current) {
      return
    }

    const renderGoogleButton = () => {
      if (!window.google || !googleButtonRef.current) {
        return
      }

      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          const googleProfile = decodeGoogleCredential(response.credential)
          if (!googleProfile.name || !googleProfile.email) {
            toast.error('Não foi possível identificar sua conta Google.')
            return
          }

          const nextProfile: CustomerProfile = { ...googleProfile, phone: '', provider: 'google' }
          localStorage.setItem(customerProfileKey, JSON.stringify(nextProfile))
          setProfile(nextProfile)
          toast.success('Conta Google conectada.')
        },
      })
      window.google.accounts.id.renderButton(googleButtonRef.current, { theme: 'outline', size: 'large', width: '320', text: 'continue_with' })
    }

    if (window.google) {
      renderGoogleButton()
      return
    }

    const script = document.createElement('script')
    script.src = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.defer = true
    script.onload = renderGoogleButton
    document.body.appendChild(script)
  }, [profile])

  const profilePhone = profile?.phone
  useEffect(() => {
    if (!profilePhone) return
    let active = true
    void findPublicOrders(profilePhone, tenantId)
      .then((found) => { if (active) setPastOrders([...found].sort((a, b) => b.id - a.id).slice(0, 6)) })
      .catch(() => undefined)
    return () => { active = false }
  }, [profilePhone, tenantId])

  const categories = useMemo(() => [
    { name: 'Todos', image: products[0]?.image },
    ...Array.from(new Set(products.map((product) => product.category))).map((name) => ({ name, image: products.find((product) => product.category === name)?.image })),
  ], [products])
  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0)
  const cartQuantity = cart.reduce((sum, item) => sum + item.quantity, 0)
  const filteredProducts = useMemo(
    () => products.filter((product) => (category === 'Todos' || product.category === category) && product.name.toLowerCase().includes(query.toLowerCase())),
    [products, category, query],
  )

  const handleSimpleSignup = () => {
    const trimmedName = signupName.trim()
    const trimmedEmail = signupEmail.trim()
    const trimmedPhone = signupPhone.trim()

    if (!trimmedName || !trimmedEmail || !trimmedPhone) {
      toast.error('Informe nome, e-mail e WhatsApp para continuar.')
      return
    }

    const nextProfile: CustomerProfile = { name: trimmedName, email: trimmedEmail, phone: trimmedPhone, provider: 'simple' }
    localStorage.setItem(customerProfileKey, JSON.stringify(nextProfile))
    setProfile(nextProfile)
    toast.success('Cadastro realizado. Agora escolha seu pedido.')
  }

  const handleLogoutProfile = () => {
    localStorage.removeItem(customerProfileKey)
    localStorage.removeItem(customerCartKey)
    setProfile(null)
    setCart([])
  }

  const addToCart = (product: Product, size?: 'P' | 'M' | 'G', price?: number) => {
    if (!cashRegister.isOpen) {
      toast.error('No momento não estamos recebendo pedidos online.')
      return
    }

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
    toast.success(`${itemName} adicionado ao pedido.`)
  }

  const addCustomItem = (item: { id: string; name: string; price: number }) => {
    if (!cashRegister.isOpen) {
      toast.error('No momento não estamos recebendo pedidos online.')
      return
    }

    setCart((current) => {
      const existing = current.find((cartItem) => cartItem.id === item.id)
      if (existing) {
        return current.map((cartItem) => cartItem.id === item.id ? { ...cartItem, quantity: cartItem.quantity + 1 } : cartItem)
      }

      return [...current, { ...item, quantity: 1 }]
    })
    toast.success(`${item.name} adicionado ao pedido.`)
  }

  const reorder = (order: Order) => {
    if (!cashRegister.isOpen) {
      toast.error('No momento não estamos recebendo pedidos online.')
      return
    }
    const { items, missing } = rebuildCartItems(order.items, products)
    if (items.length === 0) {
      toast.error('Esses itens não estão mais disponíveis no cardápio.')
      return
    }
    setCart((current) => {
      const next = [...current]
      for (const item of items) {
        const index = next.findIndex((cartItem) => cartItem.id === item.id)
        if (index >= 0) next[index] = { ...next[index], quantity: next[index].quantity + item.quantity }
        else next.push(item)
      }
      return next
    })
    toast.success(missing.length ? `Pedido #${order.id} adicionado. ${missing.length} item(ns) não disponível(is) ficaram de fora.` : `Pedido #${order.id} adicionado ao carrinho.`)
  }

  const goToCheckout = () => {
    if (!cashRegister.isOpen) {
      toast.error('No momento não estamos recebendo pedidos online.')
      return
    }

    if (cart.length === 0) {
      toast.error('Adicione ao menos um item para continuar.')
      return
    }

    navigate(`${orderPath}/checkout`)
  }

  return (
    <main className="min-h-screen bg-[#fff8f1] pb-28 text-slate-900">
      <SplashScreen name={settings.restaurant.name} logo={settings.restaurant.logo} ready={ready} storageKey={`vaija.splash.${tenantId}`} />
      <header className="relative overflow-hidden rounded-b-[36px] bg-gradient-to-br from-orange-400 via-orange-500 to-orange-700 px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))] text-white shadow-[0_18px_40px_rgba(0,0,0,0.12)] sm:px-6">
        <div className="mx-auto max-w-6xl">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/20 backdrop-blur">
              {settings.restaurant.logo ? <img src={settings.restaurant.logo} alt={settings.restaurant.name} className="h-full w-full object-cover" /> : <Sparkles className="h-5 w-5" />}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-heading text-xl font-extrabold leading-tight">{settings.restaurant.name}</p>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-white/85"><span className={`h-2 w-2 rounded-full ${cashRegister.isOpen ? 'bg-emerald-300' : 'bg-rose-300'}`} />{cashRegister.isOpen ? 'Aberto, recebendo pedidos' : 'Fechado no momento'}</p>
            </div>
            {canInstall ? <button type="button" onClick={() => isIos ? toast.info('No Safari, toque em Compartilhar e depois em "Adicionar à Tela de Início".') : void install()} className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-2 text-xs font-bold backdrop-blur transition hover:bg-white/30"><Download className="h-3.5 w-3.5" />Instalar</button> : null}
            {profile ? <button type="button" onClick={handleLogoutProfile} aria-label="Sair" className="rounded-full bg-white/15 p-2.5 backdrop-blur transition hover:bg-white/25"><LogOut className="h-4 w-4" /></button> : null}
          </div>
          <h1 className="mt-6 max-w-xl font-heading text-3xl font-extrabold leading-tight sm:text-5xl">{profile ? `Olá, ${profile.name.split(' ')[0]}!` : 'Pedidos quentinhos,'}<br /><span className="text-white/85">{profile ? 'O que vamos pedir hoje?' : 'direto na sua porta.'}</span></h1>
          {profile ? <div className="mt-5 max-w-xl"><SearchInput placeholder="Buscar no cardápio" value={query} onChange={(event) => setQuery(event.target.value)} /></div> : null}
        </div>
      </header>

      {!profile ? (
        <section className="mx-auto max-w-xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="rounded-[34px] border border-orange-100 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Identificação</p>
            <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900">Entre para ver o cardápio</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Faça um cadastro rápido ou conecte sua conta Google antes de montar o pedido.</p>
            <div className="mt-6 grid gap-3">
              <Input value={signupName} onChange={(event) => setSignupName(event.target.value)} placeholder="Seu nome" />
              <Input value={signupEmail} onChange={(event) => setSignupEmail(event.target.value)} placeholder="Seu e-mail" type="email" />
              <Input value={signupPhone} onChange={(event) => setSignupPhone(event.target.value)} placeholder="WhatsApp" inputMode="tel" />
              <Button onClick={handleSimpleSignup}>Continuar com cadastro simples</Button>
            </div>
            <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-slate-400"><span className="h-px flex-1 bg-orange-100" />ou<span className="h-px flex-1 bg-orange-100" /></div>
            {googleClientId ? <div className="flex justify-center" ref={googleButtonRef} /> : <button type="button" onClick={() => toast.error('Configure VITE_GOOGLE_CLIENT_ID para ativar o login com Google.')} className="w-full rounded-2xl border border-orange-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:border-orange-400 hover:text-orange-700">Conectar com Google</button>}
          </div>
        </section>
      ) : null}

      {profile ? (
        <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          {!cashRegister.isOpen ? (
            <div className="mb-6 rounded-[28px] border border-orange-200 bg-orange-50 p-4 text-sm font-semibold text-orange-800 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
              Pedidos online pausados. Tente novamente quando o caixa estiver aberto.
            </div>
          ) : null}
          {pastOrders.length > 0 ? (
            <div className="mb-6">
              <h2 className="mb-3 flex items-center gap-2 font-heading text-lg font-bold"><History className="h-4 w-4 text-orange-500" />Pedir de novo</h2>
              <div className="scrollbar-thin -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
                {pastOrders.map((order) => (
                  <div key={order.id} className="flex w-64 shrink-0 snap-start flex-col justify-between gap-3 rounded-[24px] border border-orange-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)]">
                    <div>
                      <p className="text-xs font-semibold text-slate-400">Pedido #{order.id} · {order.time}</p>
                      <p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-800">{order.items.join(', ')}</p>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-sm text-slate-500">{formatCurrency(order.value - (order.deliveryFee ?? 0))}</span>
                      <button type="button" onClick={() => reorder(order)} disabled={!cashRegister.isOpen} className="rounded-full bg-orange-500 px-4 py-1.5 text-xs font-bold text-white transition hover:bg-orange-600 disabled:opacity-50">Repetir</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          <h2 className="mb-3 font-heading text-lg font-bold">Categorias</h2>
          <CategoryCircles categories={categories} value={category} onChange={setCategory} />

          <div className="mt-6 grid grid-cols-[minmax(0,1fr)] gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredProducts.map((product) => (
              <article key={product.id} className="group overflow-hidden rounded-[34px] border border-orange-100 bg-white shadow-[0_18px_42px_rgba(15,23,42,0.07)] transition hover:-translate-y-1 hover:border-orange-300">
                <div className="relative h-52 overflow-hidden"><img src={product.image} alt={product.name} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /><div className="absolute left-4 top-4 rounded-full border border-white/40 bg-white/90 px-3 py-1 text-xs font-semibold text-orange-700 backdrop-blur">{product.category}</div></div>
                <div className="p-5">
                  <h2 className="font-heading text-xl font-bold">{product.name}</h2>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{product.description}</p>
                  {product.sizePrices?.length ? (
                    <div className="mt-4 grid grid-cols-3 gap-2">
                      {product.sizePrices.map((item) => (
                        <button key={item.size} type="button" onClick={() => addToCart(product, item.size, item.price)} disabled={!cashRegister.isOpen} className="rounded-2xl border border-orange-100 bg-white px-2 py-2 text-sm font-semibold text-slate-700 transition hover:border-orange-300 hover:bg-orange-50 disabled:cursor-not-allowed disabled:opacity-50">
                          {item.size} <span className="block font-mono text-xs text-slate-500">{formatCurrency(item.price)}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {isHalfEligible(product) ? (
                    <button type="button" onClick={() => { setHalfProduct(product); setHalfOpen(true) }} disabled={!cashRegister.isOpen} className="mt-2 w-full rounded-2xl border border-dashed border-orange-300 bg-orange-50/60 px-3 py-2 text-sm font-semibold text-orange-700 transition hover:bg-orange-100">Meio a meio</button>
                  ) : null}
                  <div className="mt-5 flex items-center justify-between gap-3"><p className="font-mono text-lg font-bold">{formatCurrency(product.price)}</p><Button onClick={() => addToCart(product)} disabled={!cashRegister.isOpen}>Adicionar</Button></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-3">
          <button type="button" aria-current="page" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex flex-col items-center gap-1 py-2.5 text-xs font-semibold text-orange-600"><Home className="h-5 w-5" />Cardápio</button>
          <button type="button" onClick={goToCheckout} disabled={!profile} className="relative flex flex-col items-center gap-1 py-2.5 text-xs font-semibold text-slate-500 disabled:opacity-40">
            <span className="relative"><ShoppingBag className="h-5 w-5" />{cartQuantity > 0 ? <span className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[10px] font-bold text-white">{cartQuantity}</span> : null}</span>
            {cartQuantity > 0 ? formatCurrency(subtotal) : 'Carrinho'}
          </button>
          <Link to={`${orderPath}/acompanhar`} className="flex flex-col items-center gap-1 py-2.5 text-xs font-semibold text-slate-500"><Truck className="h-5 w-5" />Acompanhar</Link>
        </div>
      </nav>

      <div className="mx-auto hidden max-w-6xl px-4 pb-10 text-sm text-slate-500 sm:px-6 lg:block lg:px-8"><Link to="/">Voltar para o site</Link></div>
      <HalfAndHalfDialog open={halfOpen} onOpenChange={setHalfOpen} products={products} initialProduct={halfProduct} onConfirm={addCustomItem} />
    </main>
  )
}
