import { useMemo, useState } from 'react'
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, ShieldCheck, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatCurrency } from '@/lib/formatters'
import { createPublicOrder } from '@/lib/orders-api'
import { parseCurrencyInput, readSettings } from '@/lib/settings'
import { readCashRegister } from '@/lib/cash-register'
import type { Order } from '@/data/mock-orders'

type CartItem = { id: string; name: string; price: number; quantity: number }
type CustomerProfile = { name: string; email: string; phone: string; provider: 'simple' | 'google' }
type CepCoordinates = { latitude: string; longitude: string }
type CepData = {
  cep: string
  state: string
  city: string
  neighborhood?: string
  street?: string
  location?: { coordinates?: CepCoordinates }
}

const customerProfileKey = 'vaija.customerProfile'
const customerCartKey = 'vaija.customerCart'

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

function normalizeCep(value: string) {
  return value.replace(/\D/g, '')
}

function getDistanceKm(origin: CepCoordinates, destination: CepCoordinates) {
  const toRadians = (value: number) => value * Math.PI / 180
  const earthRadiusKm = 6371
  const originLatitude = Number(origin.latitude)
  const originLongitude = Number(origin.longitude)
  const destinationLatitude = Number(destination.latitude)
  const destinationLongitude = Number(destination.longitude)
  const latitudeDelta = toRadians(destinationLatitude - originLatitude)
  const longitudeDelta = toRadians(destinationLongitude - originLongitude)
  const a = Math.sin(latitudeDelta / 2) ** 2 + Math.cos(toRadians(originLatitude)) * Math.cos(toRadians(destinationLatitude)) * Math.sin(longitudeDelta / 2) ** 2

  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function fetchCepData(cep: string) {
  const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${normalizeCep(cep)}`)
  if (!response.ok) {
    throw new Error('CEP inválido')
  }

  return await response.json() as CepData
}

function formatCepAddress(data: CepData) {
  return [data.street, data.neighborhood, data.city, data.state].filter(Boolean).join(', ')
}

async function geocodeAddress(data: CepData) {
  const query = encodeURIComponent([data.street, data.neighborhood, data.city, data.state, 'Brasil'].filter(Boolean).join(', '))
  const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`)
  if (!response.ok) {
    throw new Error('Endereço sem coordenadas')
  }

  const results = await response.json() as Array<{ lat: string; lon: string }>
  const firstResult = results[0]
  if (!firstResult) {
    throw new Error('Endereço sem coordenadas')
  }

  return {
    latitude: firstResult.lat,
    longitude: firstResult.lon,
  }
}

async function getCepCoordinates(cep: string) {
  const cepData = await fetchCepData(cep)
  if (cepData.location?.coordinates?.latitude && cepData.location.coordinates.longitude) {
    return cepData.location.coordinates
  }

  return geocodeAddress(cepData)
}

export function CustomerCheckoutPage() {
  const navigate = useNavigate()
  const { tenantId: routeTenantId } = useParams()
  const tenantId = routeTenantId ?? 'default'
  const orderPath = routeTenantId ? `/pedido/${encodeURIComponent(tenantId)}` : '/pedido'
  const [profile] = useState<CustomerProfile | null>(readStoredProfile)
  const [cart, setCart] = useState<CartItem[]>(() => readStoredCart(tenantId))
  const [customer, setCustomer] = useState(profile?.name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [address, setAddress] = useState('')
  const [reference, setReference] = useState('')
  const [notes, setNotes] = useState('')
  const [payment, setPayment] = useState<Order['payment']>('Pix')
  const [deliverySettings] = useState(() => readSettings().delivery)
  const [restaurantSettings] = useState(() => readSettings().restaurant)
  const [deliveryCep, setDeliveryCep] = useState('')
  const [calculatedDistanceKm, setCalculatedDistanceKm] = useState<number | null>(null)
  const [calculatedDeliveryFee, setCalculatedDeliveryFee] = useState<number | null>(null)
  const [isCalculatingDelivery, setIsCalculatingDelivery] = useState(false)
  const [isLoadingCep, setIsLoadingCep] = useState(false)

  const subtotal = useMemo(() => cart.reduce((sum, item) => sum + item.price * item.quantity, 0), [cart])
  const deliveryFee = cart.length === 0
    ? 0
    : deliverySettings.mode === 'perKm'
      ? calculatedDeliveryFee ?? 0
      : parseCurrencyInput(deliverySettings.fixedFee)
  const total = subtotal + deliveryFee

  if (!profile) {
    return <Navigate to={orderPath} replace />
  }

  const persistCart = (nextCart: CartItem[]) => {
    setCart(nextCart)
    localStorage.setItem(getCustomerCartKey(tenantId), JSON.stringify(nextCart))
  }

  const updateQuantity = (id: string, amount: number) => {
    persistCart(cart.map((item) => item.id === id ? { ...item, quantity: Math.max(1, item.quantity + amount) } : item))
  }

  const removeItem = (id: string) => {
    persistCart(cart.filter((item) => item.id !== id))
  }

  const fillAddressFromCep = async () => {
    if (normalizeCep(deliveryCep).length !== 8) {
      return
    }

    try {
      setIsLoadingCep(true)
      const cepData = await fetchCepData(deliveryCep)
      const nextAddress = formatCepAddress(cepData)

      if (nextAddress) {
        setAddress(nextAddress)
        toast.success('Endereço preenchido pelo CEP.')
      }
    } catch {
      toast.error('Não foi possível preencher o endereço pelo CEP.')
    } finally {
      setIsLoadingCep(false)
    }
  }

  const calculateDeliveryByCep = async () => {
    if (!deliverySettings.originCep.trim()) {
      toast.error('Configure o CEP da pizzaria em Configurações.')
      return null
    }

    if (normalizeCep(deliveryCep).length !== 8) {
      toast.error('Informe um CEP de entrega válido.')
      return null
    }

    try {
      setIsCalculatingDelivery(true)
      const [originCoordinates, destinationCoordinates] = await Promise.all([
        getCepCoordinates(deliverySettings.originCep),
        getCepCoordinates(deliveryCep),
      ])
      const nextDistanceKm = getDistanceKm(originCoordinates, destinationCoordinates)
      const nextDeliveryFee = nextDistanceKm * parseCurrencyInput(deliverySettings.feePerKm)

      setCalculatedDistanceKm(nextDistanceKm)
      setCalculatedDeliveryFee(nextDeliveryFee)
      toast.success(`Entrega calculada: ${nextDistanceKm.toFixed(1).replace('.', ',')} km.`)
      return nextDeliveryFee
    } catch {
      toast.error('Não foi possível calcular a entrega por CEP. Confira os CEPs informados.')
      return null
    } finally {
      setIsCalculatingDelivery(false)
    }
  }

  const handleSubmitOrder = async () => {
    if (!readCashRegister().isOpen) {
      toast.error('No momento não estamos recebendo pedidos online.')
      return
    }

    const trimmedCustomer = customer.trim()
    const trimmedPhone = phone.trim()
    const trimmedAddress = address.trim()
    const trimmedReference = reference.trim()
    const trimmedNotes = notes.trim()

    if (cart.length === 0) {
      toast.error('Seu carrinho está vazio.')
      return
    }

    if (!trimmedCustomer || !trimmedPhone || !trimmedAddress) {
      toast.error('Informe nome, WhatsApp e endereço de entrega.')
      return
    }

    const currentDeliveryFee = deliverySettings.mode === 'perKm'
      ? calculatedDeliveryFee ?? await calculateDeliveryByCep()
      : deliveryFee

    if (currentDeliveryFee === null) {
      return
    }

    const now = new Date()
    const newOrder: Omit<Order, 'id'> = {
      customer: trimmedCustomer,
      phone: trimmedPhone,
      address: trimmedReference ? `${trimmedAddress} - Ref: ${trimmedReference}` : trimmedAddress,
      source: 'Online',
      deliveryFee: currentDeliveryFee,
      items: cart.map((item) => item.quantity > 1 ? `${item.quantity}x ${item.name}` : item.name),
      elapsed: 'agora',
      value: subtotal + currentDeliveryFee,
      status: 'Pendente',
      payment,
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      notes: trimmedNotes || undefined,
    }

    const createdOrder = await createPublicOrder(newOrder, tenantId)
    persistCart([])
    toast.success(`Pedido #${createdOrder.id} enviado para o restaurante.`)
    navigate(`${orderPath}/acompanhar?pedido=${createdOrder.id}`)
  }

  return (
    <main className="min-h-screen bg-[#fff8f1] text-slate-900">
      <section className="bg-slate-950 px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link to={orderPath} className="inline-flex items-center gap-2 text-sm font-semibold text-orange-100 hover:text-white"><ArrowLeft className="h-4 w-4" />Voltar ao cardápio</Link>
            <h1 className="mt-4 font-heading text-4xl font-black">Checkout</h1>
            <p className="mt-2 text-orange-50">Revise seu pedido no {restaurantSettings.name} antes de enviar.</p>
          </div>
          <div className="rounded-[26px] border border-white/15 bg-white/10 p-4 backdrop-blur"><p className="text-sm text-orange-50">Total do pedido</p><p className="mt-1 font-heading text-3xl font-bold">{formatCurrency(total)}</p></div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-8">
        <div className="space-y-6">
          <div className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-orange-500" /><h2 className="font-heading text-2xl font-bold">Dados para entrega</h2></div>
            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <Input value={customer} onChange={(event) => setCustomer(event.target.value)} placeholder="Seu nome" />
              <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="WhatsApp" inputMode="tel" />
              <Input value={deliveryCep} onChange={(event) => {
                setDeliveryCep(event.target.value)
                setCalculatedDistanceKm(null)
                setCalculatedDeliveryFee(null)
              }} onBlur={fillAddressFromCep} placeholder="CEP de entrega" inputMode="numeric" />
              <Input className="md:col-span-2" value={address} onChange={(event) => setAddress(event.target.value)} placeholder="Endereço completo" />
              <Input className="md:col-span-2" value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Ponto de referência ou complemento" />
              {deliverySettings.mode === 'perKm' ? <Button type="button" variant="outline" onClick={calculateDeliveryByCep} disabled={isCalculatingDelivery || isLoadingCep}>{isCalculatingDelivery ? 'Calculando...' : 'Calcular entrega'}</Button> : null}
              <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Observações do pedido. Ex: sem cebola, sem molho, sem salada" className="min-h-24 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100 md:col-span-2" />
              <select value={payment} onChange={(event) => setPayment(event.target.value as Order['payment'])} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
                <option value="Pix">Pix</option>
                <option value="Cartão">Cartão</option>
                <option value="Dinheiro">Dinheiro</option>
              </select>
            </div>
          </div>

          <div className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <h2 className="font-heading text-2xl font-bold">Itens do pedido</h2>
            <div className="mt-5 space-y-3">
              {cart.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-4 text-center text-sm text-slate-500">Seu carrinho está vazio.</p> : null}
              {cart.map((item) => (
                <div key={item.id} className="rounded-[24px] border border-orange-100 bg-white p-4 shadow-[0_10px_24px_rgba(255,107,0,0.05)]">
                  <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{item.name}</p><p className="mt-1 font-mono text-sm text-slate-500">{formatCurrency(item.price)}</p></div><button type="button" onClick={() => removeItem(item.id)} className="rounded-full p-2 text-slate-400 hover:bg-orange-50 hover:text-orange-600"><Trash2 className="h-4 w-4" /></button></div>
                  <div className="mt-4 flex items-center gap-2"><Button type="button" variant="outline" className="h-9 w-9 px-0" onClick={() => updateQuantity(item.id, -1)}>-</Button><span className="min-w-8 text-center font-mono font-semibold">{item.quantity}</span><Button type="button" variant="outline" className="h-9 w-9 px-0" onClick={() => updateQuantity(item.id, 1)}>+</Button></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <aside className="lg:sticky lg:top-6 lg:self-start">
          <div className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
            <h2 className="font-heading text-2xl font-bold">Resumo</h2>
            {!readCashRegister().isOpen ? <p className="mt-3 rounded-2xl border border-orange-200 bg-orange-50 p-3 text-sm font-semibold text-orange-800">Pedidos online pausados porque o caixa está fechado.</p> : null}
            <div className="mt-5 space-y-2 rounded-[24px] border border-orange-100 bg-orange-50/50 p-4 text-sm text-slate-600">
              <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(subtotal)}</span></div>
              <div className="flex justify-between"><span>Taxa de entrega</span><span className="font-mono">{formatCurrency(deliveryFee)}</span></div>
              {calculatedDistanceKm !== null ? <div className="flex justify-between"><span>Distância</span><span className="font-mono">{calculatedDistanceKm.toFixed(1).replace('.', ',')} km</span></div> : null}
              <div className="flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span className="font-mono">{formatCurrency(total)}</span></div>
            </div>
            {deliverySettings.mode === 'perKm' ? <p className="mt-3 text-center text-xs text-slate-500">A distância é calculada automaticamente pelo CEP da pizzaria e pelo CEP de entrega.</p> : null}
            <Button className="mt-5 w-full" onClick={handleSubmitOrder} disabled={cart.length === 0}>Enviar pedido</Button>
            <Link to={orderPath} className="mt-3 block text-center text-sm font-semibold text-orange-700">Adicionar mais itens</Link>
          </div>
        </aside>
      </section>
    </main>
  )
}
