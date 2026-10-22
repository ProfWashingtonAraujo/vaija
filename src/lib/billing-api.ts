import { apiFetch } from '@/lib/api-client'
import type { PlanKey } from '@/lib/plan-access'

export type BillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD'
export type SubscriptionStatus = 'none' | 'trialing' | 'active' | 'past_due' | 'cancelled'
export type InvoiceStatus = 'open' | 'paid' | 'overdue' | 'cancelled' | 'refunded'

export type Subscription = {
  status: SubscriptionStatus
  access: 'full' | 'restricted'
  plan: PlanKey | null
  billingType?: BillingType | null
  trialEndsAt?: string | null
  currentPeriodEnd?: string | null
  overdueSince?: string | null
}

export type BillingInvoice = {
  id: number
  tenantId: string
  amount: number
  status: InvoiceStatus
  billingType: BillingType | null
  dueDate: string
  paidAt: string | null
  invoiceUrl: string | null
}

export type BillingOverview = {
  subscription: Subscription
  invoices: BillingInvoice[]
  prices: Record<PlanKey, number>
  trialDays: number
}

export type CheckoutInput = { plan: PlanKey; billingType: BillingType; name: string; email: string; cpfCnpj: string }
export type CheckoutResult = { subscription: Subscription; invoiceUrl: string | null }

/** Código de erro devolvido pelo backend ({ ok: false, error }). */
export class BillingError extends Error {
  code: string

  constructor(code: string) {
    super(code)
    this.code = code
  }
}

const jsonHeaders = { 'Content-Type': 'application/json' }

async function readJson<T>(response: Response) {
  const data = await response.json().catch(() => ({})) as T & { error?: string }
  if (!response.ok) throw new BillingError(data.error ?? `billing_request_failed:${response.status}`)
  return data
}

export async function fetchBillingOverview() {
  return readJson<BillingOverview>(await apiFetch('/api/billing/status'))
}

export async function startCheckout(input: CheckoutInput) {
  return readJson<CheckoutResult>(await apiFetch('/api/billing/checkout', { method: 'POST', headers: jsonHeaders, body: JSON.stringify(input) }))
}

export async function cancelSubscription() {
  return readJson<{ subscription: Subscription }>(await apiFetch('/api/billing/cancel', { method: 'POST' }))
}

const errorMessages: Record<string, string> = {
  invalid_cpf_cnpj: 'CPF ou CNPJ inválido.',
  billing_not_configured: 'A cobrança ainda não está configurada. Fale com o suporte.',
  gateway_rejected: 'O meio de pagamento recusou os dados. Confira CPF/CNPJ e e-mail.',
  gateway_unavailable: 'Não conseguimos falar com o meio de pagamento. Tente de novo em instantes.',
  forbidden: 'Só o administrador da loja pode alterar a assinatura.',
}

export function billingErrorMessage(error: unknown) {
  return errorMessages[error instanceof BillingError ? error.code : ''] ?? 'Não foi possível concluir. Tente de novo.'
}
