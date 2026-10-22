import type { ReactNode } from 'react'
import { ArrowDownRight, ArrowUpRight, ExternalLink, ReceiptText } from 'lucide-react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { billingTypeLabels, type BillingInvoice, type InvoiceStatus } from '@/lib/billing-api'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

export const invoiceTones: Record<InvoiceStatus, { label: string; style: string }> = {
  paid: { label: 'Paga', style: 'bg-sa-ok-soft text-sa-ok' },
  open: { label: 'Em aberto', style: 'bg-sa-warn-soft text-sa-warn' },
  overdue: { label: 'Em atraso', style: 'bg-sa-bad-soft text-sa-bad' },
  cancelled: { label: 'Cancelada', style: 'bg-sa-hover text-sa-muted' },
  refunded: { label: 'Estornada', style: 'bg-sa-hover text-sa-muted' },
}

const calendarDate = (value: string) => new Date(value).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

export function SaasCard({ title, description, action, children, className }: { title?: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-2xl border border-sa-border bg-sa-surface p-5 shadow-sa sm:p-6', className)}>
      {title ? (
        <div className="mb-5 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-heading text-lg font-bold text-sa-text">{title}</h2>
            {description ? <p className="mt-0.5 text-sm text-sa-muted">{description}</p> : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </section>
  )
}

export function FeaturedStat({ label, value, caption, delta, icon }: { label: string; value: string; caption: string; delta?: number | null; icon: ReactNode }) {
  return (
    <div className="relative flex flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 p-6 text-white shadow-[0_16px_36px_rgba(255,107,0,0.28)]">
      <div className="pointer-events-none absolute -right-10 -top-12 h-44 w-44 rounded-full bg-white/10" />
      <div className="pointer-events-none absolute -bottom-16 right-12 h-40 w-40 rounded-full bg-white/10" />
      <div className="relative flex items-start justify-between gap-3">
        <p className="text-sm font-semibold text-orange-50">{label}</p>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20">{icon}</div>
      </div>
      <p className="relative mt-4 font-heading text-4xl font-extrabold tracking-tight sm:text-5xl">{value}</p>
      <div className="relative mt-4 flex flex-wrap items-center gap-2 text-sm text-orange-50">
        {delta !== undefined && delta !== null ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2.5 py-1 text-xs font-bold">
            {delta >= 0 ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}
            {Math.abs(delta)}%
          </span>
        ) : null}
        <span>{caption}</span>
      </div>
    </div>
  )
}

export function StatTile({ label, value, detail, icon, tone = 'accent' }: { label: string; value: string; detail: string; icon: ReactNode; tone?: 'accent' | 'ok' | 'warn' | 'bad' | 'info' }) {
  const tones = {
    accent: 'bg-sa-accent-soft text-sa-accent-text',
    ok: 'bg-sa-ok-soft text-sa-ok',
    warn: 'bg-sa-warn-soft text-sa-warn',
    bad: 'bg-sa-bad-soft text-sa-bad',
    info: 'bg-sa-info-soft text-sa-info',
  }
  return (
    <div className="rounded-2xl border border-sa-border bg-sa-surface p-5 shadow-sa">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-sa-muted">{label}</p>
        <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl', tones[tone])}>{icon}</div>
      </div>
      <p className="mt-3 font-heading text-2xl font-bold text-sa-text sm:text-3xl">{value}</p>
      <p className="mt-1 text-xs font-medium text-sa-soft">{detail}</p>
    </div>
  )
}

const monthLabel = (key: string) => new Date(`${key}-01T12:00:00`).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')

function lastMonths(count: number) {
  const now = new Date()
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - (count - 1 - index), 1)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
  })
}

export function RevenueChart({ invoices }: { invoices: BillingInvoice[] }) {
  const data = lastMonths(6).map((key) => ({
    name: monthLabel(key),
    received: invoices.filter((invoice) => invoice.status === 'paid' && invoice.paidAt?.slice(0, 7) === key).reduce((sum, invoice) => sum + invoice.amount, 0),
    pending: invoices.filter((invoice) => (invoice.status === 'open' || invoice.status === 'overdue') && invoice.dueDate.slice(0, 7) === key).reduce((sum, invoice) => sum + invoice.amount, 0),
  }))
  const isEmpty = data.every((item) => item.received === 0 && item.pending === 0)

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-4 text-xs font-semibold text-sa-muted">
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--sa-chart-1)' }} />Recebido</span>
        <span className="inline-flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--sa-chart-2)' }} />A receber e em atraso</span>
      </div>
      {isEmpty ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-sa-border text-center text-sm font-medium text-sa-muted">
          <ReceiptText className="h-5 w-5 text-sa-accent-text" />
          Ainda não há cobranças nos últimos 6 meses.
        </div>
      ) : (
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ left: 0, right: 8, top: 8 }} barGap={4}>
              <CartesianGrid vertical={false} stroke="var(--sa-border)" strokeDasharray="3 4" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: 'var(--sa-muted)', fontSize: 12 }} />
              <YAxis axisLine={false} tickLine={false} width={56} tick={{ fill: 'var(--sa-muted)', fontSize: 12 }} tickFormatter={(value: number) => (value >= 1000 ? `R$ ${(value / 1000).toFixed(1).replace('.0', '')}k` : `R$ ${value}`)} />
              <Tooltip
                cursor={{ fill: 'var(--sa-hover)' }}
                formatter={(value, name) => [formatCurrency(Number(value)), name === 'received' ? 'Recebido' : 'A receber e em atraso']}
                contentStyle={{ background: 'var(--sa-surface)', border: '1px solid var(--sa-border)', borderRadius: 12, color: 'var(--sa-text)' }}
                labelStyle={{ color: 'var(--sa-muted)' }}
                itemStyle={{ color: 'var(--sa-text)' }}
              />
              <Bar dataKey="received" fill="var(--sa-chart-1)" radius={[6, 6, 0, 0]} maxBarSize={28} />
              <Bar dataKey="pending" fill="var(--sa-chart-2)" radius={[6, 6, 0, 0]} maxBarSize={28} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  )
}

export type SubscriptionMixCounts = { active: number; trialing: number; past_due: number; cancelled: number; none: number }

const mixItems = [
  { key: 'active', label: 'Ativas', color: 'var(--sa-ok)' },
  { key: 'trialing', label: 'Em teste grátis', color: 'var(--sa-info)' },
  { key: 'past_due', label: 'Em atraso', color: 'var(--sa-bad)' },
  { key: 'cancelled', label: 'Canceladas', color: 'var(--sa-soft)' },
  { key: 'none', label: 'Sem cobrança', color: 'var(--sa-border-strong)' },
] as const

export function SubscriptionMix({ counts }: { counts: SubscriptionMixCounts }) {
  const total = mixItems.reduce((sum, item) => sum + counts[item.key], 0)
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-sa-hover" role="img" aria-label="Distribuição das assinaturas por situação">
        {total > 0 ? mixItems.map((item) => counts[item.key] > 0 ? <div key={item.key} style={{ width: `${counts[item.key] / total * 100}%`, background: item.color }} /> : null) : null}
      </div>
      <ul className="mt-5 space-y-3">
        {mixItems.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3 text-sm">
            <span className="flex items-center gap-2.5 font-medium text-sa-text-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />{item.label}</span>
            <span className="font-mono font-bold text-sa-text">{counts[item.key]}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export type InvoiceRowInfo = { name: string; plan?: string | null }

export function InvoiceTable({ invoices, describe, onOpenClient, emptyText = 'Nenhuma cobrança por aqui.' }: { invoices: BillingInvoice[]; describe: (tenantId: string) => InvoiceRowInfo; onOpenClient?: (tenantId: string) => void; emptyText?: string }) {
  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-sa-border p-8 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sa-accent-soft text-sa-accent-text"><ReceiptText className="h-5 w-5" /></div>
        <p className="text-sm font-semibold text-sa-text-2">{emptyText}</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-sa-border">
      <div className="hidden grid-cols-[minmax(160px,1.6fr)_100px_110px_120px_124px] gap-4 border-b border-sa-border bg-sa-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-sa-soft md:grid">
        <span>Cliente</span><span>Vencimento</span><span>Valor</span><span>Status</span><span className="text-right">Ações</span>
      </div>
      <ul className="divide-y divide-sa-border">
        {invoices.map((invoice) => {
          const info = describe(invoice.tenantId)
          const tone = invoiceTones[invoice.status]
          return (
            <li key={invoice.id} className="grid gap-2 px-4 py-3.5 transition-colors hover:bg-sa-hover md:grid-cols-[minmax(160px,1.6fr)_100px_110px_120px_124px] md:items-center md:gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-sa-text">{info.name}</p>
                <p className="mt-0.5 truncate text-xs text-sa-muted">{info.plan ? `Plano ${info.plan}` : 'Plano não informado'}{invoice.billingType ? ` · ${billingTypeLabels[invoice.billingType]}` : ''}</p>
              </div>
              <p className="text-sm text-sa-text-2"><span className="mr-2 text-xs text-sa-soft md:hidden">Vence</span>{calendarDate(invoice.dueDate)}</p>
              <p className="font-mono text-sm font-bold text-sa-text">{formatCurrency(invoice.amount)}</p>
              <span className={cn('w-fit rounded-full px-2.5 py-1 text-xs font-semibold', tone.style)}>{tone.label}</span>
              <div className="flex items-center gap-1 md:justify-end">
                {invoice.invoiceUrl ? (
                  <a href={invoice.invoiceUrl} target="_blank" rel="noopener noreferrer" aria-label="Abrir fatura no Asaas" title="Abrir fatura no Asaas" className="flex h-8 w-8 items-center justify-center rounded-lg text-sa-muted transition-colors hover:bg-sa-surface-2 hover:text-sa-accent-text"><ExternalLink className="h-4 w-4" /></a>
                ) : null}
                {onOpenClient ? <button type="button" onClick={() => onOpenClient(invoice.tenantId)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-sa-muted transition-colors hover:bg-sa-surface-2 hover:text-sa-accent-text">Cliente</button> : null}
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
