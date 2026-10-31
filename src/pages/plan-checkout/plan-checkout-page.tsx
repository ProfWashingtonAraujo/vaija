import { useMemo, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Check, CheckCircle2, Info, MessageCircle, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import { Input } from '@/components/ui/input'
import type { PricingPlan } from '@/data/pricing-plans'
import { usePricingPlans } from '@/data/use-pricing-plans'
import { submitLead as sendLead } from '@/lib/saas-api'
import type { PlanKey } from '@/lib/plan-access'
import { cn } from '@/lib/utils'

const salesWhatsapp = '5599999999999'

export function PlanCheckoutPage() {
  const { plans, status, retry } = usePricingPlans()

  if (plans.length === 0) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fff8f1] px-4 text-center">
        {status === 'error' ? (
          <div className="max-w-sm rounded-[30px] border border-orange-100 bg-white p-6">
            <p className="font-semibold text-slate-800">Não conseguimos carregar os planos agora.</p>
            <Button className="mt-4" onClick={retry}>Tentar de novo</Button>
          </div>
        ) : <p className="text-sm font-medium text-slate-500">Carregando planos...</p>}
      </main>
    )
  }

  return <PlanCheckoutForm plans={plans} />
}

function PlanCheckoutForm({ plans }: { plans: PricingPlan[] }) {
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const requestedPlan = searchParams.get('plano') ?? 'Pro'
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

    const lead = {
      plan: currentPlan.name as PlanKey,
      restaurantName: trimmedRestaurantName,
      ownerName: trimmedOwnerName,
      phone: trimmedPhone,
      email: trimmedEmail,
      city: trimmedCity,
      notes: notes.trim() || undefined,
    }

    // O lead vai para o painel do dono; o WhatsApp abre na hora, sem esperar a resposta.
    void sendLead(lead).catch(() => undefined)
    toast.success('Interesse registrado. Vamos abrir o WhatsApp comercial.')

    const message = encodeURIComponent(`Olá! Quero contratar o plano ${currentPlan.name} da Vaija. Restaurante: ${lead.restaurantName}. Responsável: ${lead.ownerName}. Cidade: ${lead.city}. WhatsApp: ${lead.phone}. E-mail: ${lead.email}.`)
    window.open(`https://wa.me/${salesWhatsapp}?text=${message}`, '_blank', 'noopener,noreferrer')
  }

  if (user?.roleKey === 'admin' && !user.isPlatformAdmin) {
    return <Navigate to={`/subscription?plano=${encodeURIComponent(planName)}`} replace />
  }

  const fieldClass = 'bg-white border-orange-100 focus:border-orange-400 focus:ring-orange-100 placeholder:text-slate-400 text-slate-800'
  const labelClass = 'grid gap-2 text-sm font-semibold text-slate-700'

  return (
    <main className="min-h-screen bg-[#fff8f1] text-slate-900">
      <section className="bg-slate-950 px-4 pb-12 pt-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <Link to="/#planos" className="inline-flex items-center gap-2 text-sm font-semibold text-orange-100 transition hover:text-white"><ArrowLeft className="h-4 w-4" />Voltar aos planos</Link>
          <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-center">
            <div>
              <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-orange-100">Contratação assistida</p>
              <h1 className="mt-4 max-w-2xl font-heading text-3xl font-black leading-[1.1] tracking-tight sm:text-5xl">Escolha seu plano e fale com nosso comercial</h1>
              <p className="mt-4 max-w-xl text-base leading-7 text-orange-50/90">Registramos seu interesse e levamos você direto para o WhatsApp com a mensagem pronta.</p>
            </div>
            <ol className="grid gap-3 rounded-[28px] border border-white/15 bg-white/[0.06] p-5 backdrop-blur">
              {[
                ['Escolha o plano', 'Veja o que cada um inclui no resumo.'],
                ['Preencha seus dados', 'Leva menos de um minuto.'],
                ['Converse no WhatsApp', 'Nosso comercial configura tudo com você.'],
              ].map(([title, text], index) => (
                <li key={title} className="flex items-start gap-3">
                  <span className="flex h-7 w-7 flex-none items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">{index + 1}</span>
                  <span><span className="block text-sm font-semibold">{title}</span><span className="block text-sm text-orange-50/75">{text}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:px-8">
        <form onSubmit={submitLead} className="rounded-[28px] border border-orange-100 bg-white p-6 shadow-[0_18px_42px_rgba(15,23,42,0.08)] sm:p-8">
          <h2 className="flex items-center gap-2.5 font-heading text-xl font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">1</span>Escolha o plano</h2>
          <div role="radiogroup" aria-label="Plano" className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))]">
            {plans.map((plan) => {
              const active = plan.name === currentPlan.name
              return (
                <button
                  key={plan.name}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPlanName(plan.name)}
                  className={cn(
                    'relative rounded-2xl border p-4 text-left transition focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-orange-100',
                    active ? 'border-orange-400 bg-orange-50 shadow-[0_8px_20px_rgba(255,107,0,0.14)]' : 'border-orange-100 bg-white hover:border-orange-300',
                  )}
                >
                  {plan.highlight ? <span className="absolute -top-2.5 right-3 rounded-full bg-orange-500 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">{plan.badge ?? 'Popular'}</span> : null}
                  <span className="flex items-center justify-between gap-2">
                    <span className="font-heading text-base font-bold">{plan.name}</span>
                    <span className={cn('flex h-5 w-5 items-center justify-center rounded-full border transition', active ? 'border-orange-500 bg-orange-500 text-white' : 'border-slate-300')}>{active ? <Check className="h-3 w-3" strokeWidth={3} /> : null}</span>
                  </span>
                  <span className="mt-1 block text-sm font-semibold text-slate-600">{plan.price}</span>
                </button>
              )
            })}
          </div>

          <h2 className="mt-8 flex items-center gap-2.5 font-heading text-xl font-bold"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-orange-500 text-sm font-bold text-white">2</span>Dados para contratação</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Restaurante<Input className={fieldClass} value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} placeholder="Nome do restaurante" autoComplete="organization" required /></label>
            <label className={labelClass}>Responsável<Input className={fieldClass} value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Seu nome" autoComplete="name" required /></label>
            <label className={labelClass}>WhatsApp<Input className={fieldClass} value={phone} onChange={(event) => setPhone(formatPhone(event.target.value))} placeholder="(00) 99999-9999" inputMode="tel" autoComplete="tel" required /></label>
            <label className={labelClass}>E-mail<Input className={fieldClass} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="email@empresa.com" type="email" autoComplete="email" required /></label>
            <label className={cn(labelClass, 'md:col-span-2')}>Cidade/UF<Input className={fieldClass} value={city} onChange={(event) => setCity(event.target.value)} placeholder="Ex: Recife/PE" autoComplete="address-level2" required /></label>
            <label className={cn(labelClass, 'md:col-span-2')}>Observações <span className="font-normal text-slate-400">(opcional)</span><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Conte rapidamente o que sua operação precisa" className="min-h-24 resize-y rounded-xl border border-orange-100 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /></label>
          </div>
          <Button type="submit" className="mt-6 h-12 w-full shadow-[0_16px_30px_rgba(255,107,0,0.22)]"><MessageCircle className="mr-2 h-4 w-4" />Solicitar contratação pelo WhatsApp</Button>
          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-slate-500"><ShieldCheck className="h-3.5 w-3.5 text-orange-500" />Seus dados são usados só para o contato comercial.</p>
        </form>

        <aside className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-6 shadow-[0_18px_42px_rgba(15,23,42,0.08)] sm:p-8 lg:sticky lg:top-6 lg:self-start">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Resumo do plano</p>
          <div className="mt-2 flex items-baseline justify-between gap-3">
            <h2 className="font-heading text-2xl font-bold text-slate-900">{currentPlan.name}</h2>
            <p className="font-heading text-2xl font-extrabold text-orange-600">{currentPlan.price}</p>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">{currentPlan.description}</p>
          <div className="mt-5 rounded-2xl border border-orange-100 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Telas inclusas</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {currentPlan.screens.map((screen) => <span key={screen} className="rounded-full border border-orange-100 bg-orange-50 px-3 py-1 text-xs font-semibold text-slate-700">{screen}</span>)}
            </div>
          </div>
          <ul className="mt-5 space-y-2.5">
            {currentPlan.features.map((feature) => <li key={feature} className="flex items-start gap-3 text-sm text-slate-700"><CheckCircle2 className="mt-0.5 h-4 w-4 flex-none text-orange-500" />{feature}</li>)}
          </ul>
          <p className="mt-5 flex items-start gap-2.5 rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-6 text-slate-600"><Info className="mt-0.5 h-4 w-4 flex-none text-slate-400" />Sem pagamento automático ainda. O fechamento acontece com nosso comercial para configurar cobrança, implantação e acesso inicial.</p>
        </aside>
      </section>
    </main>
  )
}

/** Máscara de telefone brasileiro: (11) 91234-5678 ou (11) 1234-5678. */
function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  if (digits.length <= 2) return digits
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`
  if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`
}
