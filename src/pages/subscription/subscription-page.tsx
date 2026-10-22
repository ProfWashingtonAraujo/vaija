import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, ExternalLink, ReceiptText } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth, useTenant } from '@/contexts/auth-context'
import { usePricingPlans } from '@/data/use-pricing-plans'
import {
  billingErrorMessage, cancelSubscription, fetchBillingOverview, invoiceStatusLabels, startCheckout, subscriptionStatusLabels,
  type BillingInvoice, type BillingOverview, type BillingType,
} from '@/lib/billing-api'
import { invalidateBillingAccess } from '@/lib/billing-access'
import { formatCurrency } from '@/lib/formatters'
import type { PlanKey } from '@/lib/plan-access'
import { cn } from '@/lib/utils'

const billingTypes: { value: BillingType; label: string }[] = [
  { value: 'PIX', label: 'PIX' },
  { value: 'BOLETO', label: 'Boleto' },
  { value: 'CREDIT_CARD', label: 'Cartão de crédito' },
]

const planKeys: PlanKey[] = ['Free', 'Start', 'Pro', 'Premium']
const fieldClass = 'h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100'
const formatDate = (value: string) => new Date(value).toLocaleDateString('pt-BR')
// Vencimento e pagamento chegam como data (meia-noite UTC); no fuso do Brasil cairiam no dia anterior.
const formatCalendarDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

function maskCpfCnpj(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 14)
  if (digits.length <= 11) {
    return digits.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return digits.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3').replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
}

export function SubscriptionPage() {
  const { refreshTenant } = useAuth()
  const tenant = useTenant()
  const [searchParams] = useSearchParams()
  const requestedPlan = planKeys.find((key) => key.toLowerCase() === (searchParams.get('plano') ?? '').toLowerCase())
  const [overview, setOverview] = useState<BillingOverview | null>(null)
  const [plan, setPlan] = useState<PlanKey>(requestedPlan ?? 'Pro')
  const [billingType, setBillingType] = useState<BillingType>('PIX')
  const [name, setName] = useState(tenant.ownerName)
  const [email, setEmail] = useState(tenant.email)
  const [cpfCnpj, setCpfCnpj] = useState('')
  const [sending, setSending] = useState(false)
  const [payUrl, setPayUrl] = useState<string | null>(null)

  const planDetails = usePricingPlans()
  const load = () => fetchBillingOverview().then((data) => {
    invalidateBillingAccess()
    setOverview(data)
  })

  useEffect(() => {
    void load().catch(() => toast.error('Não foi possível carregar sua assinatura.'))
  }, [])

  const subscription = overview?.subscription
  const hasSubscription = subscription && subscription.status !== 'none' && subscription.status !== 'cancelled'
  const pendingInvoice = overview?.invoices.find((invoice) => invoice.status === 'open' || invoice.status === 'overdue')
  const price = overview?.prices[plan] ?? 0
  const trialDays = overview?.trialDays ?? 0
  const eligibleForTrial = !subscription?.trialEndsAt && price > 0

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (price > 0 && (name.trim().length < 2 || !email.includes('@') || ![11, 14].includes(cpfCnpj.replace(/\D/g, '').length))) {
      toast.error('Informe nome, e-mail e um CPF ou CNPJ válido.')
      return
    }
    setSending(true)
    try {
      const result = await startCheckout({ plan, billingType, name: name.trim(), email: email.trim(), cpfCnpj })
      await refreshTenant()
      setPayUrl(result.invoiceUrl)
      await load()
      toast.success(price === 0 ? 'Plano Free ativado.' : 'Assinatura criada. Enviamos a cobrança para o seu e-mail.')
    } catch (error) {
      toast.error(billingErrorMessage(error))
    } finally {
      setSending(false)
    }
  }

  const cancel = async () => {
    if (!window.confirm('Cancelar a assinatura? O acesso ao painel será restringido.')) return
    try {
      await cancelSubscription()
      await load()
      toast.success('Assinatura cancelada.')
    } catch (error) {
      toast.error(billingErrorMessage(error))
    }
  }

  const renderInvoice = (invoice: BillingInvoice) => (
    <div key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-orange-50/30 p-4">
      <div>
        <p className="font-semibold text-slate-900">{formatCurrency(invoice.amount)}</p>
        <p className="mt-1 text-xs text-slate-500">Vence em {formatCalendarDate(invoice.dueDate)}{invoice.paidAt ? ` · paga em ${formatCalendarDate(invoice.paidAt)}` : ''}</p>
      </div>
      <div className="flex items-center gap-3">
        <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', invoiceStatusLabels[invoice.status].style)}>{invoiceStatusLabels[invoice.status].label}</span>
        {invoice.invoiceUrl && (invoice.status === 'open' || invoice.status === 'overdue') ? (
          <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-orange-600 hover:text-orange-700">Pagar<ExternalLink className="h-3.5 w-3.5" /></a>
        ) : null}
      </div>
    </div>
  )

  return (
    <AdminLayout title="Assinatura" description="Escolha seu plano, pague a mensalidade e acompanhe as faturas.">
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-6">
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Situação atual</p>
                <h2 className="mt-1 font-heading text-2xl font-bold text-slate-900">{subscription?.plan ? `Plano ${subscription.plan}` : 'Nenhum plano contratado'}</h2>
              </div>
              {subscription ? <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', subscriptionStatusLabels[subscription.status].style)}>{subscriptionStatusLabels[subscription.status].label}</span> : null}
            </div>
            {subscription?.status === 'trialing' && subscription.trialEndsAt ? <p className="mt-3 text-sm text-slate-600">Seu teste grátis vai até {formatDate(subscription.trialEndsAt)}. A primeira cobrança vence nessa data.</p> : null}
            {subscription?.status === 'active' && subscription.currentPeriodEnd ? <p className="mt-3 text-sm text-slate-600">Próxima cobrança em {formatCalendarDate(subscription.currentPeriodEnd)}.</p> : null}
            {subscription?.status === 'past_due' ? <p className="mt-3 text-sm font-medium text-red-600">Há uma fatura em atraso. Pague para manter o painel liberado.</p> : null}
            {subscription?.status === 'cancelled' ? <p className="mt-3 text-sm text-slate-600">Sua assinatura foi cancelada. Escolha um plano ao lado para reativar.</p> : null}
            {pendingInvoice?.invoiceUrl ? (
              <a href={pendingInvoice.invoiceUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block"><Button type="button">Pagar fatura de {formatCurrency(pendingInvoice.amount)}</Button></a>
            ) : null}
            {hasSubscription && subscription?.plan !== 'Free' ? <button type="button" onClick={cancel} className="mt-4 block text-sm font-medium text-slate-400 underline hover:text-red-600">Cancelar assinatura</button> : null}
          </section>

          <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <h2 className="font-heading text-xl font-bold text-slate-900">Faturas</h2>
            <div className="mt-5 space-y-3">
              {overview?.invoices.map(renderInvoice)}
              {overview && overview.invoices.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center text-sm font-semibold text-slate-500">
                  <ReceiptText className="h-5 w-5 text-orange-500" />
                  Nenhuma fatura ainda.
                </div>
              ) : null}
            </div>
          </section>
        </div>

        <form onSubmit={submit} className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
          <h2 className="font-heading text-xl font-bold text-slate-900">{hasSubscription ? 'Trocar de plano' : 'Contratar um plano'}</h2>
          <div className="mt-5 grid gap-2">
            {planKeys.map((key) => {
              const details = planDetails.find((item) => item.name === key)
              return (
                <button key={key} type="button" onClick={() => setPlan(key)} className={cn('flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition', plan === key ? 'border-orange-400 bg-orange-50 ring-4 ring-orange-100' : 'border-orange-100 hover:bg-orange-50/50')}>
                  <span>
                    <span className="block font-semibold text-slate-900">{key}</span>
                    <span className="block text-xs text-slate-500">{details?.description}</span>
                  </span>
                  <span className="shrink-0 pl-3 text-sm font-bold text-slate-900">{overview ? (overview.prices[key] === 0 ? 'Grátis' : `${formatCurrency(overview.prices[key])}/mês`) : ''}</span>
                </button>
              )
            })}
          </div>

          {price > 0 ? (
            <div className="mt-5 grid gap-3">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Nome do responsável ou razão social" maxLength={120} />
              <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail para receber a cobrança" type="email" maxLength={160} />
              <Input value={cpfCnpj} onChange={(event) => setCpfCnpj(maskCpfCnpj(event.target.value))} placeholder="CPF ou CNPJ" inputMode="numeric" />
              <select value={billingType} onChange={(event) => setBillingType(event.target.value as BillingType)} aria-label="Forma de pagamento" className={fieldClass}>
                {billingTypes.map((type) => <option key={type.value} value={type.value}>{type.label}</option>)}
              </select>
              {eligibleForTrial && trialDays > 0 ? <p className="flex items-start gap-2 text-sm text-emerald-700"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{trialDays} dias grátis. Você só paga depois do teste.</p> : null}
            </div>
          ) : null}

          <Button type="submit" disabled={sending || !overview || (hasSubscription && subscription?.plan === plan)} className="mt-5 w-full">
            {sending ? 'Processando...' : price === 0 ? 'Usar plano Free' : eligibleForTrial ? `Começar teste grátis do ${plan}` : `Assinar ${plan}`}
          </Button>

          {payUrl ? (
            <a href={payUrl} target="_blank" rel="noopener noreferrer" className="mt-4 flex items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
              Abrir página de pagamento<ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </form>
      </div>
    </AdminLayout>
  )
}
