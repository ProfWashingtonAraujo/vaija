import { useMemo, useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, MessageCircle, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getPricingPlans } from '@/data/pricing-plans'
import { cn } from '@/lib/utils'

type PlanLead = {
  id: number
  plan: string
  restaurantName: string
  ownerName: string
  phone: string
  email: string
  city: string
  notes?: string
  createdAt: string
  status: 'Novo'
}

const planLeadsKey = 'vaija.planLeads'
const salesWhatsapp = '5599999999999'

function readPlanLeads() {
  const storedLeads = localStorage.getItem(planLeadsKey)
  return storedLeads ? JSON.parse(storedLeads) as PlanLead[] : []
}

export function PlanCheckoutPage() {
  const [searchParams] = useSearchParams()
  const requestedPlan = searchParams.get('plano') ?? 'Pro'
  const plans = useMemo(() => getPricingPlans(), [])
  const selectedPlan = plans.find((plan) => plan.name.toLowerCase() === requestedPlan.toLowerCase()) ?? plans[1] ?? plans[0]
  const [planName, setPlanName] = useState(selectedPlan.name)
  const [restaurantName, setRestaurantName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [city, setCity] = useState('')
  const [notes, setNotes] = useState('')
  const currentPlan = useMemo(() => plans.find((plan) => plan.name === planName) ?? selectedPlan, [planName, plans, selectedPlan])

  const submitLead = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedRestaurantName = restaurantName.trim()
    const trimmedOwnerName = ownerName.trim()
    const trimmedPhone = phone.trim()
    const trimmedEmail = email.trim()
    const trimmedCity = city.trim()

    if (!trimmedRestaurantName || !trimmedOwnerName || !trimmedPhone || !trimmedEmail || !trimmedCity) {
      toast.error('Preencha restaurante, responsável, WhatsApp, e-mail e cidade.')
      return
    }

    const leads = readPlanLeads()
    const lead: PlanLead = {
      id: Math.max(0, ...leads.map((item) => item.id)) + 1,
      plan: currentPlan.name,
      restaurantName: trimmedRestaurantName,
      ownerName: trimmedOwnerName,
      phone: trimmedPhone,
      email: trimmedEmail,
      city: trimmedCity,
      notes: notes.trim() || undefined,
      createdAt: new Date().toISOString(),
      status: 'Novo',
    }

    localStorage.setItem(planLeadsKey, JSON.stringify([lead, ...leads]))
    toast.success('Interesse registrado. Vamos abrir o WhatsApp comercial.')

    const message = encodeURIComponent(`Olá! Quero contratar o plano ${currentPlan.name} da Vaija. Restaurante: ${lead.restaurantName}. Responsável: ${lead.ownerName}. Cidade: ${lead.city}. WhatsApp: ${lead.phone}. E-mail: ${lead.email}.`)
    window.open(`https://wa.me/${salesWhatsapp}?text=${message}`, '_blank', 'noopener,noreferrer')
  }

  return (
    <main className="min-h-screen bg-[#fff8f1] text-slate-900">
      <section className="bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link to="/#planos" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-100 hover:text-white"><ArrowLeft className="h-4 w-4" />Voltar aos planos</Link>
          <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end">
            <div>
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-orange-50">Contratação assistida</p>
              <h1 className="mt-5 max-w-3xl font-heading text-4xl font-black tracking-tight sm:text-6xl">Escolha seu plano e fale com nosso comercial</h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-orange-50">Registramos seu interesse e levamos você direto para o WhatsApp com a mensagem pronta.</p>
            </div>
            <div className="rounded-[30px] border border-white/15 bg-white/10 p-5 backdrop-blur">
              <p className="text-sm text-orange-50">Plano selecionado</p>
              <p className="mt-2 font-heading text-4xl font-bold">{currentPlan.name}</p>
              <p className="mt-2 text-orange-50">{currentPlan.price}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <form onSubmit={submitLead} className="rounded-[34px] border border-orange-100 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
          <div className="flex items-center gap-3"><ShieldCheck className="h-5 w-5 text-orange-500" /><h2 className="font-heading text-2xl font-bold">Dados para contratação</h2></div>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-slate-700">Plano<select value={planName} onChange={(event) => setPlanName(event.target.value)} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">{plans.map((plan) => <option key={plan.name} value={plan.name}>{plan.name} - {plan.price}</option>)}</select></label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">Restaurante<Input value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} placeholder="Nome do restaurante" /></label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">Responsável<Input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Seu nome" /></label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">WhatsApp<Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="(00) 99999-9999" inputMode="tel" /></label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">E-mail<Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@empresa.com" type="email" /></label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700">Cidade/UF<Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex: Recife/PE" /></label>
            <label className="grid gap-2 text-sm font-semibold text-slate-700 md:col-span-2">Observações<textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Conte rapidamente o que sua operação precisa" className="min-h-24 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /></label>
          </div>
          <Button type="submit" className="mt-6 w-full shadow-[0_16px_30px_rgba(255,107,0,0.22)]"><MessageCircle className="mr-2 h-4 w-4" />Solicitar contratação pelo WhatsApp</Button>
        </form>

        <aside className="rounded-[34px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-6 shadow-[0_18px_42px_rgba(15,23,42,0.08)] lg:sticky lg:top-6 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Resumo</p>
          <h2 className="mt-2 font-heading text-3xl font-bold text-slate-900">{currentPlan.name}</h2>
          <p className="mt-3 font-heading text-4xl font-extrabold text-slate-900">{currentPlan.price}</p>
          <p className="mt-3 text-sm leading-6 text-slate-600">{currentPlan.description}</p>
          <div className="mt-6 rounded-[24px] border border-orange-100 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Telas inclusas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {currentPlan.screens.map((screen) => <span key={screen} className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-semibold text-slate-700">{screen}</span>)}
            </div>
          </div>
          <div className="mt-6 space-y-3">
            {currentPlan.features.map((feature) => <div key={feature} className="flex items-start gap-3 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 text-orange-500" />{feature}</div>)}
          </div>
          <div className={cn('mt-6 rounded-[24px] border p-4 text-sm leading-6', currentPlan.highlight ? 'border-orange-200 bg-orange-50 text-orange-800' : 'border-slate-100 bg-white text-slate-600')}>Sem pagamento automático ainda. O fechamento acontece com nosso comercial para configurar cobrança, implantação e acesso inicial.</div>
        </aside>
      </section>
    </main>
  )
}
