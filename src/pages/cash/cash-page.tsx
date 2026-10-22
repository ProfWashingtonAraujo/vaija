import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Bike, Download, Lock, LockOpen, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { CashReportView, differenceLabel, downloadCashHistoryCsv, downloadCashReportCsv, formatDateTime, hoursOpenTooLong, printCashReport } from '@/components/cash/cash-report'
import { CloseCashDialog, MovementDialog, OpenCashDialog, SettleCourierDialog, type SettleTarget } from '@/components/cash/cash-dialogs'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cashErrorMessage, fetchCashSession, fetchCashSessions, fetchCourierCash, fetchCurrentCash, voidCashMovement, type CashMovement, type CashReport, type CashSessionSummary, type CourierCash, type ManualMovementKind } from '@/lib/cash-api'
import { cashRegisterUpdatedEvent } from '@/lib/cash-register'
import { formatCurrency } from '@/lib/formatters'
import { usePolling } from '@/lib/use-polling'
import { cn } from '@/lib/utils'

const cardClass = 'rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]'

export function CashPage() {
  const location = useLocation()
  const wantsClose = Boolean((location.state as { close?: boolean } | null)?.close)
  const handledClose = useRef<string | null>(null)

  const [report, setReport] = useState<CashReport | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [sessions, setSessions] = useState<CashSessionSummary[]>([])
  const [courierCash, setCourierCash] = useState<CourierCash | null>(null)
  const [openDialog, setOpenDialog] = useState(false)
  const [movementKind, setMovementKind] = useState<ManualMovementKind | null>(null)
  const [settleTarget, setSettleTarget] = useState<SettleTarget | null>(null)
  const [closing, setClosing] = useState<CashReport | null>(null)
  const [viewing, setViewing] = useState<CashReport | null>(null)

  const loadCurrent = useCallback(() => fetchCurrentCash().then(setReport), [])
  const loadSessions = useCallback(() => fetchCashSessions().then(setSessions), [])
  const loadCourierCash = useCallback(() => fetchCourierCash().then(setCourierCash), [])

  useEffect(() => {
    void Promise.all([loadCurrent(), loadSessions(), loadCourierCash()])
      .catch((error) => toast.error(cashErrorMessage(error)))
      .finally(() => setLoaded(true))
  }, [loadCurrent, loadSessions, loadCourierCash])

  usePolling(() => Promise.all([loadCurrent(), loadCourierCash()]).catch(() => undefined), 15_000)

  // abrir ou fechar o caixa por outro lugar (botão do cabeçalho) atualiza esta tela na hora
  useEffect(() => {
    const refresh = () => {
      void loadCurrent().catch(() => undefined)
      void loadSessions().catch(() => undefined)
      void loadCourierCash().catch(() => undefined)
    }
    window.addEventListener(cashRegisterUpdatedEvent, refresh)
    return () => window.removeEventListener(cashRegisterUpdatedEvent, refresh)
  }, [loadCurrent, loadSessions, loadCourierCash])

  // relatório atualizado na hora de fechar, para o esperado não ficar defasado
  const startClosing = useCallback(async () => {
    try {
      const fresh = await fetchCurrentCash()
      setReport(fresh)
      if (fresh) setClosing(fresh)
      else toast.error('O caixa já está fechado.')
    } catch (error) {
      toast.error(cashErrorMessage(error))
    }
  }, [])

  // veio do botão "Fechar caixa" do cabeçalho
  useEffect(() => {
    if (!loaded || !wantsClose || handledClose.current === location.key) return
    handledClose.current = location.key
    void startClosing()
  }, [loaded, wantsClose, location.key, startClosing])

  const viewSession = async (id: number) => {
    try {
      setViewing(await fetchCashSession(id))
    } catch (error) {
      toast.error(cashErrorMessage(error))
    }
  }

  const voidMovement = async (movement: CashMovement) => {
    try {
      setReport(await voidCashMovement(movement.id))
      void loadCourierCash().catch(() => undefined)
      toast.success('Movimentação estornada.')
    } catch (error) {
      toast.error(cashErrorMessage(error))
    }
  }

  const isOpen = report !== null
  const cash = report?.cash
  const forgottenHours = hoursOpenTooLong(report?.session.openedAt)
  const tiles = report && cash ? [
    { label: 'Esperado na gaveta', value: formatCurrency(cash.expected), highlight: true },
    { label: 'Total vendido', value: formatCurrency(report.sales.gross) },
    { label: 'Vendas em dinheiro na gaveta', value: formatCurrency(cash.drawerCashSales ?? cash.cashSales) },
    { label: 'Sangrias / suprimentos', value: `${formatCurrency(cash.sangrias)} / ${formatCurrency(cash.suprimentos)}` },
  ] : []

  return (
    <AdminLayout title="Fluxo de caixa" description="Abertura com fundo de troco, sangrias, leitura X e fechamento com o dinheiro contado.">
      {forgottenHours !== null ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>Este caixa está aberto há {forgottenHours} horas. Se o turno já acabou, faça a contagem e feche, para o dinheiro de turnos diferentes não se misturar.</p>
        </div>
      ) : null}

      <section className={cardClass}>
        {!loaded ? <div className="h-16 animate-pulse rounded-2xl bg-orange-50" /> : isOpen && report ? (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600"><LockOpen className="h-6 w-6" /></span>
              <div>
                <p className="font-heading text-2xl font-bold text-slate-900">Caixa aberto</p>
                <p className="text-sm text-slate-500">Por {report.session.openedBy} desde {formatDateTime(report.session.openedAt)} · fundo de troco {formatCurrency(report.session.openingFloat)}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" className="gap-2" onClick={() => setMovementKind('sangria')}><ArrowUpFromLine className="h-4 w-4" />Sangria</Button>
              <Button variant="outline" className="gap-2" onClick={() => setMovementKind('suprimento')}><ArrowDownToLine className="h-4 w-4" />Suprimento</Button>
              <Button variant="secondary" className="gap-2" onClick={() => { if (!printCashReport(report)) toast.error('Libere pop-ups para imprimir.') }}><Printer className="h-4 w-4" />Leitura X</Button>
              <Button className="gap-2" onClick={() => void startClosing()}><Lock className="h-4 w-4" />Fechar caixa</Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-500"><Lock className="h-6 w-6" /></span>
              <div>
                <p className="font-heading text-2xl font-bold text-slate-900">Caixa fechado</p>
                <p className="text-sm text-slate-500">Abra o caixa para registrar as vendas do turno e receber pedidos online.</p>
              </div>
            </div>
            <Button className="gap-2" onClick={() => setOpenDialog(true)}><LockOpen className="h-4 w-4" />Abrir caixa</Button>
          </div>
        )}
      </section>

      {isOpen && report ? (
        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {tiles.map(({ label, value, highlight }) => (
            <div key={label} className={cn('rounded-[28px] border bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]', highlight ? 'border-orange-300' : 'border-orange-100')}>
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <p className={cn('mt-4 font-heading text-2xl font-bold', highlight ? 'text-orange-600' : 'text-slate-900')}>{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {loaded && courierCash ? (
        <section className={cn(cardClass, 'mt-6')}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-slate-900"><Bike className="h-5 w-5 text-orange-500" />Dinheiro com entregadores</h3>
            {courierCash.outstandingTotal > 0 ? <span className="font-mono text-lg font-bold text-orange-600">{formatCurrency(courierCash.outstandingTotal)}</span> : null}
          </div>
          <p className="mt-1 text-sm text-slate-500">Pedidos pagos em dinheiro e entregues por entregador: o dinheiro só entra no caixa quando você recebe dele (acerto).</p>
          <div className="mt-4 space-y-3">
            {courierCash.outstanding.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-center text-sm text-slate-500">Nenhum dinheiro pendente com entregadores.</p> : null}
            {courierCash.outstanding.map((courier) => (
              <div key={courier.name || '__none__'} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-100 p-4">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{courier.name || 'Sem entregador informado'}</p>
                  <p className="text-sm text-slate-500">{courier.count} {courier.count === 1 ? 'pedido' : 'pedidos'}: {courier.orders.map((order) => `#${order.orderId}`).join(', ')}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-lg font-bold text-slate-900">{formatCurrency(courier.total)}</span>
                  {isOpen ? (
                    <Button className="h-9 rounded-full px-4 text-sm" onClick={() => setSettleTarget({ name: courier.name, count: courier.count, total: courier.total })}>Receber</Button>
                  ) : <span className="text-xs text-slate-400">Abra o caixa para receber</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {isOpen && report ? (
        <section className={cn(cardClass, 'mt-6')}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-heading text-xl font-bold text-slate-900">Leitura X ao vivo</h3>
              <p className="mt-1 text-sm text-slate-500">Atualiza sozinha. Mostra o turno até agora, sem fechar o caixa. A venda entra quando o pedido é finalizado.</p>
            </div>
            <Button variant="outline" className="h-9 gap-2 rounded-full px-4 text-sm" onClick={() => downloadCashReportCsv(report)}><Download className="h-4 w-4" />Exportar planilha</Button>
          </div>
          <div className="mt-4">
            <CashReportView report={report} onVoid={(movement) => void voidMovement(movement)} />
          </div>
        </section>
      ) : null}

      <section className={cn(cardClass, 'mt-6')}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-heading text-xl font-bold text-slate-900">Caixas anteriores</h3>
          <Button variant="outline" className="h-9 gap-2 rounded-full px-4 text-sm" disabled={sessions.length === 0} onClick={() => downloadCashHistoryCsv(sessions)}><Download className="h-4 w-4" />Exportar histórico</Button>
        </div>
        <div className="mt-4 space-y-3">
          {loaded && sessions.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-4 text-center text-sm text-slate-500">Nenhum caixa fechado ainda. Os fechamentos aparecem aqui, com o relatório de cada um.</p> : null}
          {sessions.map((session) => (
            <button key={session.id} type="button" onClick={() => void viewSession(session.id)} className="flex w-full flex-wrap items-center justify-between gap-3 rounded-2xl border border-orange-100 p-4 text-left transition hover:border-orange-300 hover:bg-orange-50/40">
              <div>
                <p className="font-semibold text-slate-900">{formatDateTime(session.openedAt)} → {formatDateTime(session.closedAt)}</p>
                <p className="text-sm text-slate-500">{session.openedBy}{session.closedBy && session.closedBy !== session.openedBy ? ` / ${session.closedBy}` : ''} · {session.salesCount} {session.salesCount === 1 ? 'pedido' : 'pedidos'} · {formatCurrency(session.gross)}</p>
              </div>
              {session.difference !== null ? (
                <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', Math.abs(session.difference) < 0.005 ? 'bg-emerald-50 text-emerald-700' : session.difference > 0 ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700')}>{differenceLabel(session.difference)}</span>
              ) : null}
            </button>
          ))}
        </div>
      </section>

      <OpenCashDialog open={openDialog} onOpenChange={setOpenDialog} onOpened={setReport} />
      <MovementDialog kind={movementKind} onClose={() => setMovementKind(null)} onSaved={setReport} />
      <SettleCourierDialog target={settleTarget} onClose={() => setSettleTarget(null)} onSettled={(updated) => { setReport(updated); void loadCourierCash().catch(() => undefined) }} />
      <CloseCashDialog
        report={closing}
        onClose={() => setClosing(null)}
        onClosed={(finalReport) => {
          setClosing(null)
          setReport(null)
          setViewing(finalReport)
          void loadSessions().catch(() => undefined)
          void loadCourierCash().catch(() => undefined)
        }}
      />
      <Dialog open={viewing !== null} onOpenChange={(open) => { if (!open) setViewing(null) }}>
        <DialogContent className="max-h-[calc(100vh-2rem)] max-w-lg overflow-y-auto">
          <DialogTitle className="pr-8 font-heading text-2xl font-bold text-slate-900">{viewing?.session.closedAt ? 'Relatório do caixa' : 'Leitura X'}</DialogTitle>
          <DialogDescription className="sr-only">Resumo das vendas, dinheiro esperado e movimentações do caixa.</DialogDescription>
          {viewing ? (
            <div className="mt-4 grid gap-5">
              <CashReportView report={viewing} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Button className="gap-2" onClick={() => { if (!printCashReport(viewing)) toast.error('Libere pop-ups para imprimir.') }}><Printer className="h-4 w-4" />Imprimir relatório</Button>
                <Button variant="outline" className="gap-2" onClick={() => downloadCashReportCsv(viewing)}><Download className="h-4 w-4" />Exportar planilha</Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  )
}
