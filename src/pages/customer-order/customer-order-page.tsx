import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, Check, ShoppingBag, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { SearchInput } from '@/components/shared/search-input'
import { CategoryTabs } from '@/components/pos/category-tabs'
import { formatCurrency } from '@/lib/formatters'
import { fetchProducts } from '@/lib/catalog-api'
import { products as initialProducts, type Product } from '@/data/mock-products'
import { readSettings } from '@/lib/settings'
import { cashRegisterUpdatedEvent, readCashRegister, type CashRegisterState } from '@/lib/cash-register'

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

function readStoredCart() {
  const storedCart = localStorage.getItem(customerCartKey)
  return storedCart ? JSON.parse(storedCart) as CartItem[] : []
}

export function CustomerOrderPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState<Product[]>(initialProducts.filter((product) => product.available))
  const [category, setCategory] = useState('Todos')
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<CartItem[]>(readStoredCart)
  const [profile, setProfile] = useState<CustomerProfile | null>(readStoredProfile)
  const [signupName, setSignupName] = useState(profile?.name ?? '')
  const [signupEmail, setSignupEmail] = useState(profile?.email ?? '')
  const [signupPhone, setSignupPhone] = useState(profile?.phone ?? '')
  const [cashRegister, setCashRegister] = useState(() => readCashRegister())
  const googleButtonRef = useRef<HTMLDivElement>(null)
  const settings = readSettings()

  useEffect(() => {
    void fetchProducts()
      .then((loadedProducts) => setProducts(loadedProducts.filter((product) => product.available)))
      .catch(() => toast.error('Não foi possível carregar o cardápio.'))
  }, [])

  useEffect(() => {
    localStorage.setItem(customerCartKey, JSON.stringify(cart))
  }, [cart])

  useEffect(() => {
    const updateCashRegister = (event: Event) => {
      setCashRegister((event as CustomEvent<CashRegisterState>).detail ?? readCashRegister())
    }

    window.addEventListener(cashRegisterUpdatedEvent, updateCashRegister)
    return () => window.removeEventListener(cashRegisterUpdatedEvent, updateCashRegister)
  }, [])

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

  const categories = useMemo(() => ['Todos', ...Array.from(new Set(products.map((product) => product.category)))], [products])
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

  const goToCheckout = () => {
    if (!cashRegister.isOpen) {
      toast.error('No momento não estamos recebendo pedidos online.')
      return
    }

    if (cart.length === 0) {
      toast.error('Adicione ao menos um item para continuar.')
      return
    }

    navigate('/pedido/checkout')
  }

  return (
    <main className="min-h-screen bg-[#fff8f1] pb-28 text-slate-900">
      <section className="relative overflow-hidden bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,107,0,0.38),transparent_32%),linear-gradient(135deg,#111827,#431407_55%,#ff6b00)]" />
        <div className="relative mx-auto grid max-w-6xl gap-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-orange-50 backdrop-blur">
                {settings.restaurant.logo ? <img src={settings.restaurant.logo} alt={settings.restaurant.name} className="h-6 w-6 rounded-full object-cover" /> : <Sparkles className="h-4 w-4" />} Cardápio premium online
              </div>
              <h1 className="mt-5 max-w-3xl font-heading text-4xl font-black tracking-tight sm:text-6xl">Peça agora no {settings.restaurant.name}</h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-orange-50">{cashRegister.isOpen ? 'Escolha com calma, monte seu pedido e finalize em uma etapa segura de checkout.' : 'O caixa está fechado no momento. O cardápio segue disponível para consulta, mas pedidos online estão pausados.'}</p>
            </div>
          {profile ? (
            <div className="rounded-[32px] border border-white/20 bg-white/10 p-5 shadow-[0_30px_80px_rgba(0,0,0,0.28)] backdrop-blur">
              <p className="text-sm text-orange-50">Resumo atual</p>
              <p className="mt-2 font-heading text-4xl font-bold">{formatCurrency(subtotal)}</p>
              <p className="mt-2 text-sm text-orange-50">{cartQuantity} item(ns) no carrinho</p>
              <Button className="mt-5 w-full" onClick={goToCheckout} disabled={!cashRegister.isOpen}>Ir para checkout <ArrowRight className="ml-2 h-4 w-4" /></Button>
            </div>
          ) : null}
        </div>
      </section>

      {!profile ? (
        <section className="mx-auto max-w-xl px-4 py-8 sm:px-6 lg:px-8">
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
          <div className="mb-6 flex flex-col gap-3 rounded-[28px] border border-orange-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Cliente conectado</p><p className="mt-1 font-semibold text-slate-900">{profile.name} · {profile.email}</p></div>
            <Button variant="outline" onClick={handleLogoutProfile}>Sair</Button>
          </div>

          <div className="rounded-[34px] border border-orange-100 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <SearchInput placeholder="Buscar no cardápio" value={query} onChange={(event) => setQuery(event.target.value)} />
            <div className="mt-4"><CategoryTabs categories={categories} value={category} onChange={setCategory} /></div>
          </div>

          <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
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
                  <div className="mt-5 flex items-center justify-between gap-3"><p className="font-mono text-lg font-bold">{formatCurrency(product.price)}</p><Button onClick={() => addToCart(product)} disabled={!cashRegister.isOpen}>Adicionar</Button></div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}

      {profile ? (
        <div className="fixed bottom-4 left-1/2 z-40 w-[calc(100%-2rem)] max-w-3xl -translate-x-1/2 rounded-[28px] border border-orange-200 bg-white/95 p-3 shadow-[0_24px_70px_rgba(15,23,42,0.22)] backdrop-blur">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3"><div className="rounded-2xl bg-orange-500 p-3 text-white"><ShoppingBag className="h-5 w-5" /></div><div><p className="font-semibold text-slate-900">{cartQuantity} item(ns) selecionado(s)</p><p className="font-mono text-sm text-slate-500">Subtotal {formatCurrency(subtotal)}</p></div></div>
            <Button onClick={goToCheckout} disabled={cart.length === 0 || !cashRegister.isOpen}>Finalizar pedido <Check className="ml-2 h-4 w-4" /></Button>
          </div>
        </div>
      ) : null}

      <div className="mx-auto hidden max-w-6xl px-4 pb-10 text-sm text-slate-500 sm:px-6 lg:block lg:px-8"><Link to="/">Voltar para o site</Link></div>
    </main>
  )
}
