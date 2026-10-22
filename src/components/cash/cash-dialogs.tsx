import { useEffect, useState, type FormEvent } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { differenceLabel } from '@/components/cash/cash-report'
import { addCashMovement, cashErrorMessage, closeCash, movementReasons, openCash, parseMoney, type CashMovementKind, type CashReport } from '@/lib/cash-api'
import { formatCurrency } from '@/lib/formatters'
import { cn } from '@/lib/utils'

const selectClass = 'h-11 w-full rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100'

function MoneyField({ label, value, onChange, hint, autoFocus }: { label: string; value: string; onChange: (value: string) => void; hint?: string; autoFocus?: boolean }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
      {label}
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-sm text-slate-400">R$</span>
        <Input value={value} onChange={(event) => onChange(event.target.value)} inputMode="decimal" placeholder="0,00" autoFocus={autoFocus} className="pl-11 font-mono" />
      </div>
      {hint ? <span className="text-xs font-normal text-slate-500">{hint}</span> : null}
    </label>
  )
}

/** Abertura do caixa: o fundo de troco é o dinheiro que já está na gaveta. */
export function OpenCashDialog({ open, onOpenChange, onOpened }: { open: boolean; onOpenChange: (open: boolean) => void; onOpened: (report: CashReport) => void }) {
  const [floatText, setFloatText] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (open) { setFloatText(''); setNote('') }
  }, [open])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const openingFloat = parseMoney(floatText === '' ? '0' : floatText)
    if (openingFloat === null) {
      toast.error('Informe o fundo de troco com um valor válido. Se a gaveta está vazia, use 0.')
      return
    }
    setBusy(true)
    try {
      const report = await openCash(openingFloat, note)
      toast.success('Caixa aberto. Os pedidos online estão liberados.')
      onOpened(report)
      onOpenChange(false)
    } catch (error) {
      toast.error(cashErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="grid gap-5">
          <div>
            <DialogTitle className="pr-8 font-heading text-2xl font-bold text-slate-900">Abrir caixa</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-slate-500">Informe quanto dinheiro tem na gaveta para começar (o fundo de troco). Ao abrir, o cardápio online passa a receber pedidos.</DialogDescription>
          </div>
          <MoneyField label="Fundo de troco" value={floatText} onChange={setFloatText} autoFocus hint="Deixe 0 se a gaveta está vazia." />
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Observação <span className="font-normal text-slate-400">(opcional)</span>
            <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} placeholder="Ex: turno da noite" />
          </label>
          <Button type="submit" disabled={busy}>{busy ? 'Abrindo...' : 'Abrir caixa'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

const movementCopy: Record<CashMovementKind, { title: string; description: string; cta: string }> = {
  sangria: { title: 'Sangria', description: 'Retirada de dinheiro do caixa, por exemplo para levar ao cofre ou pagar uma compra.', cta: 'Registrar sangria' },
  suprimento: { title: 'Suprimento', description: 'Dinheiro que você coloca no caixa, por exemplo para reforçar o troco.', cta: 'Registrar suprimento' },
}

/** Sangria (sai dinheiro) ou suprimento (entra dinheiro), com motivo. */
export function MovementDialog({ kind, onClose, onSaved }: { kind: CashMovementKind | null; onClose: () => void; onSaved: (report: CashReport) => void }) {
  const [amountText, setAmountText] = useState('')
  const [reason, setReason] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (kind) { setAmountText(''); setReason(movementReasons[kind][0][0]); setNote('') }
  }, [kind])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (!kind) return
    const amount = parseMoney(amountText)
    if (amount === null || amount <= 0) {
      toast.error('Informe um valor maior que zero.')
      return
    }
    setBusy(true)
    try {
      const report = await addCashMovement(kind, amount, reason, note)
      toast.success(`${movementCopy[kind].title} de ${formatCurrency(amount)} registrada.`)
      onSaved(report)
      onClose()
    } catch (error) {
      toast.error(cashErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const copy = kind ? movementCopy[kind] : movementCopy.sangria
  return (
    <Dialog open={kind !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <form onSubmit={submit} className="grid gap-5">
          <div>
            <DialogTitle className="pr-8 font-heading text-2xl font-bold text-slate-900">{copy.title}</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-slate-500">{copy.description}</DialogDescription>
          </div>
          <MoneyField label="Valor" value={amountText} onChange={setAmountText} autoFocus />
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Motivo
            <select value={reason} onChange={(event) => setReason(event.target.value)} className={selectClass}>
              {(kind ? movementReasons[kind] : []).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Observação <span className="font-normal text-slate-400">(opcional)</span>
            <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} placeholder="Ex: compra de gás" />
          </label>
          <Button type="submit" disabled={busy}>{busy ? 'Salvando...' : copy.cta}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}

/** Fechamento: o gerente conta o dinheiro da gaveta e o app mostra a diferença antes de encerrar. */
export function CloseCashDialog({ report, onClose, onClosed }: { report: CashReport | null; onClose: () => void; onClosed: (report: CashReport) => void }) {
  const [countedText, setCountedText] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (report) { setCountedText(''); setNote('') }
  }, [report?.session.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const expected = report?.cash.expected ?? 0
  const counted = parseMoney(countedText)
  const difference = counted === null ? null : Math.round((counted - expected) * 100) / 100

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    if (counted === null) {
      toast.error('Conte o dinheiro da gaveta e informe o valor para fechar o caixa.')
      return
    }
    setBusy(true)
    try {
      const closed = await closeCash(counted, note)
      toast.success('Caixa fechado. O cardápio online está pausado.')
      onClosed(closed)
    } catch (error) {
      toast.error(cashErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={report !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-h-[calc(100vh-2rem)] max-w-md overflow-y-auto">
        <form onSubmit={submit} className="grid gap-5">
          <div>
            <DialogTitle className="pr-8 font-heading text-2xl font-bold text-slate-900">Fechar caixa</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-slate-500">Conte o dinheiro que está na gaveta e informe abaixo. O app compara com o que deveria ter.</DialogDescription>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4 text-sm">
            <div className="flex justify-between text-slate-600"><span>Fundo de troco + vendas em dinheiro + suprimentos − sangrias</span></div>
            <div className="mt-2 flex items-baseline justify-between"><span className="font-semibold text-slate-900">Esperado na gaveta</span><span className="font-mono text-xl font-bold text-slate-900">{formatCurrency(expected)}</span></div>
          </div>
          {report && report.pix.unconfirmedCount > 0 ? <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">{report.pix.unconfirmedCount} {report.pix.unconfirmedCount === 1 ? 'pedido Pix está' : 'pedidos Pix estão'} sem confirmação de pagamento ({formatCurrency(report.pix.unconfirmedTotal)}). Confira antes de fechar.</p> : null}
          <MoneyField label="Dinheiro contado" value={countedText} onChange={setCountedText} autoFocus hint="Obrigatório. Conte as notas e moedas da gaveta." />
          {difference !== null ? (
            <p className={cn('rounded-2xl px-4 py-3 text-center text-sm font-semibold', Math.abs(difference) < 0.005 ? 'bg-emerald-50 text-emerald-700' : difference > 0 ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700')}>{differenceLabel(difference)}</p>
          ) : null}
          <label className="grid gap-1.5 text-sm font-semibold text-slate-700">
            Observação <span className="font-normal text-slate-400">(opcional, útil se houver diferença)</span>
            <Input value={note} onChange={(event) => setNote(event.target.value)} maxLength={120} placeholder="Ex: troco dado a mais na mesa 4" />
          </label>
          <Button type="submit" disabled={busy || counted === null}>{busy ? 'Fechando...' : 'Fechar caixa'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
