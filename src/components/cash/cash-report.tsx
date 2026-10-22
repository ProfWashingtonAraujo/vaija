import { AlertTriangle } from 'lucide-react'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { reasonLabel, type CashMovement, type CashReport, type CashSessionSummary } from '@/lib/cash-api'
import { csvNumber, csvRow, csvText, downloadCsv } from '@/lib/csv'
import { formatCurrency } from '@/lib/formatters'
import { readSettings } from '@/lib/settings'
import { cn } from '@/lib/utils'

export function formatDateTime(iso: string | null) {
  return iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'
}

/** Sobra, falta ou fechamento exato, com o texto que o gerente espera ver. */
export function differenceLabel(difference: number) {
  if (Math.abs(difference) < 0.005) return 'Caixa conferido, sem diferença'
  return difference > 0 ? `Sobra de ${formatCurrency(difference)}` : `Falta de ${formatCurrency(Math.abs(difference))}`
}

/** Horas desde a abertura, quando passou de 16 h (turno esquecido aberto); senão null. */
export function hoursOpenTooLong(openedAt: string | null | undefined) {
  if (!openedAt) return null
  const hours = (Date.now() - new Date(openedAt).getTime()) / 3_600_000
  return hours > 16 ? Math.floor(hours) : null
}

const reportTitle = (report: CashReport) => (report.session.closedAt ? 'Fechamento de caixa (leitura Z)' : 'Leitura X (parcial)')

const movementTitle = (movement: CashMovement) => {
  if (movement.kind === 'acerto') return 'Acerto de entregador'
  return `${movement.kind === 'sangria' ? 'Sangria' : 'Suprimento'} · ${reasonLabel(movement.kind, movement.reason)}`
}

/** Entradas somam no caixa (suprimento, acerto); a sangria tira. */
const movementSign = (movement: CashMovement) => (movement.kind === 'sangria' ? '−' : '+')

/** Valores do dinheiro no caixa; relatórios fechados antes dos acertos não têm os campos novos. */
function cashFigures(report: CashReport) {
  const { cash } = report
  return {
    drawerSales: cash.drawerCashSales ?? cash.cashSales,
    courierSales: cash.courierCashSales ?? 0,
    acertos: cash.acertos ?? 0,
    outstanding: report.couriers?.outstandingTotal ?? 0,
  }
}

/** Sangrias válidas somadas por motivo (as estornadas não contam). */
function sangriasByReason(movements: CashMovement[]) {
  const totals = new Map<string, number>()
  for (const movement of movements) {
    if (movement.kind !== 'sangria' || movement.voided) continue
    const label = reasonLabel('sangria', movement.reason)
    totals.set(label, Math.round(((totals.get(label) ?? 0) + movement.amount) * 100) / 100)
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1])
}

function Line({ label, value, strong, tone, muted }: { label: string; value: string; strong?: boolean; tone?: 'plus' | 'minus'; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between gap-3', strong && 'text-base font-semibold text-sa-text', muted && 'text-xs text-sa-soft')}>
      <span className={cn(tone === 'minus' && 'text-sa-bad', tone === 'plus' && 'text-sa-ok')}>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

/** Relatório do caixa: serve para a leitura X (ao vivo), o fechamento (Z) e o histórico. Com `onVoid`, permite estornar. */
export function CashReportView({ report, onVoid }: { report: CashReport; onVoid?: (movement: CashMovement) => void }) {
  const { session, sales, cash, pix, cancelled, movements } = report
  const closed = session.closedAt !== null
  const figures = cashFigures(report)
  const reasons = sangriasByReason(movements)

  return (
    <div className="space-y-5 text-sm text-sa-text-2">
      <div className="rounded-2xl border border-sa-border bg-sa-surface-2 p-4">
        <p className="font-semibold text-sa-text">{reportTitle(report)}</p>
        <p className="mt-1">Aberto por {session.openedBy} em {formatDateTime(session.openedAt)}</p>
        {closed ? <p>Fechado por {session.closedBy} em {formatDateTime(session.closedAt)}</p> : <p>Emitido em {formatDateTime(report.period.end)}</p>}
        {session.openingNote ? <p className="mt-1 text-sa-muted">Obs. da abertura: {session.openingNote}</p> : null}
      </div>

      {pix.unconfirmedCount > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-sa-border bg-sa-warn-soft p-3 text-sa-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{pix.unconfirmedCount} {pix.unconfirmedCount === 1 ? 'pedido Pix' : 'pedidos Pix'} ({formatCurrency(pix.unconfirmedTotal)}) finalizado{pix.unconfirmedCount === 1 ? '' : 's'} sem confirmação de pagamento. Confira no app do banco.</p>
        </div>
      ) : null}

      {figures.outstanding > 0 && report.couriers ? (
        <div className="flex items-start gap-3 rounded-2xl border border-sa-border bg-sa-warn-soft p-3 text-sa-warn">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{formatCurrency(figures.outstanding)} em dinheiro ainda com entregadores ({report.couriers.outstanding.map((courier) => `${courier.name || 'sem nome'} ${formatCurrency(courier.total)}`).join(', ')}). Não conta no dinheiro esperado até o acerto.</p>
        </div>
      ) : null}

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sa-soft">Vendas por forma de pagamento</h4>
        <div className="space-y-1.5 rounded-2xl border border-sa-border bg-sa-surface p-4">
          {sales.byPayment.map((row) => <Line key={row.method} label={`${row.method} · ${row.count} ${row.count === 1 ? 'pedido' : 'pedidos'}`} value={formatCurrency(row.total)} />)}
          <div className="border-t border-sa-border pt-2">
            <Line label={`Total vendido · ${sales.count} ${sales.count === 1 ? 'pedido' : 'pedidos'}`} value={formatCurrency(sales.gross)} strong />
          </div>
          <p className="pt-1 text-xs text-sa-muted">Produtos {formatCurrency(sales.products)} + taxas de entrega {formatCurrency(sales.deliveryFees)}</p>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sa-soft">Por tipo de pedido</h4>
        <div className="space-y-1.5 rounded-2xl border border-sa-border bg-sa-surface p-4">
          {sales.bySource.map((row) => <Line key={row.source} label={`${row.source} · ${row.count}`} value={formatCurrency(row.total)} />)}
          {cancelled.count > 0 ? <div className="border-t border-sa-border pt-2"><Line label={`Cancelados (não entram no total) · ${cancelled.count}`} value={formatCurrency(cancelled.total)} /></div> : null}
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sa-soft">Dinheiro no caixa</h4>
        <div className="space-y-1.5 rounded-2xl border border-sa-border bg-sa-surface p-4">
          <Line label="Fundo de troco" value={formatCurrency(cash.openingFloat)} />
          <Line label="Vendas em dinheiro na gaveta" value={`+ ${formatCurrency(figures.drawerSales)}`} tone="plus" />
          {figures.courierSales > 0 ? <Line label="Vendas em dinheiro com entregadores (só contam no acerto)" value={formatCurrency(figures.courierSales)} muted /> : null}
          {figures.acertos > 0 || figures.courierSales > 0 ? <Line label="Acertos de entregadores" value={`+ ${formatCurrency(figures.acertos)}`} tone="plus" /> : null}
          <Line label="Suprimentos" value={`+ ${formatCurrency(cash.suprimentos)}`} tone="plus" />
          <Line label="Sangrias" value={`− ${formatCurrency(cash.sangrias)}`} tone="minus" />
          <div className="border-t border-sa-border pt-2">
            <Line label="Esperado no caixa" value={formatCurrency(cash.expected)} strong />
          </div>
          {closed && session.countedCash !== null && session.difference !== null ? (
            <>
              <Line label="Contado" value={formatCurrency(session.countedCash)} />
              <p className={cn('rounded-xl px-3 py-2 text-center font-semibold', Math.abs(session.difference) < 0.005 ? 'bg-sa-ok-soft text-sa-ok' : session.difference > 0 ? 'bg-sa-info-soft text-sa-info' : 'bg-sa-bad-soft text-sa-bad')}>{differenceLabel(session.difference)}</p>
              {session.closingNote ? <p className="text-xs text-sa-muted">Obs. do fechamento: {session.closingNote}</p> : null}
            </>
          ) : null}
        </div>
      </section>

      {reasons.length > 0 ? (
        <section>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sa-soft">Sangrias por motivo</h4>
          <div className="space-y-1.5 rounded-2xl border border-sa-border bg-sa-surface p-4">
            {reasons.map(([label, total]) => <Line key={label} label={label} value={formatCurrency(total)} />)}
          </div>
        </section>
      ) : null}

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-sa-soft">Movimentações do caixa</h4>
        {movements.length === 0 ? <p className="rounded-2xl border border-dashed border-sa-border bg-sa-surface-2 p-3 text-center">Nenhuma movimentação neste caixa.</p> : (
          <ul className="divide-y divide-sa-border rounded-2xl border border-sa-border bg-sa-surface">
            {movements.map((movement) => (
              <li key={movement.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className={cn('font-semibold', movement.voided ? 'text-sa-soft line-through' : 'text-sa-text')}>{movementTitle(movement)}</p>
                  <p className="text-xs text-sa-muted">{formatDateTime(movement.createdAt)} · {movement.createdBy}{movement.note ? ` · ${movement.note}` : ''}</p>
                  {movement.voided ? <p className="text-xs font-semibold text-sa-warn">Estornada{movement.voidedBy ? ` por ${movement.voidedBy}` : ''}</p> : null}
                  {onVoid && !movement.voided ? (
                    <ConfirmDialog
                      trigger={<button type="button" className="mt-1 text-xs font-semibold text-sa-muted hover:text-sa-text">Estornar</button>}
                      title="Estornar movimentação"
                      description={`Estornar "${movementTitle(movement)}" de ${formatCurrency(movement.amount)}? Ela continua na lista, riscada, e deixa de contar no caixa.${movement.kind === 'acerto' ? ' Os pedidos voltam a aparecer como dinheiro com o entregador.' : ''}`}
                      confirmLabel="Estornar"
                      onConfirm={() => onVoid(movement)}
                    />
                  ) : null}
                </div>
                <span className={cn('shrink-0 font-mono font-semibold', movement.voided ? 'text-sa-soft line-through' : movement.kind === 'sangria' ? 'text-sa-bad' : 'text-sa-ok')}>{movementSign(movement)} {formatCurrency(movement.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string)

/** Imprime o relatório no mesmo estilo do cupom (largura de bobina). Textos digitados são escapados. */
export function printCashReport(report: CashReport) {
  const { session, sales, cash, pix, cancelled, movements } = report
  const figures = cashFigures(report)
  const restaurant = readSettings().restaurant.name
  const row = (label: string, value: string, bold = false) =>
    `<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;${bold ? 'font-weight:bold;font-size:13px' : ''}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`
  const rule = '<div style="border-top:1px dashed #999;margin:8px 0"></div>'
  const heading = (text: string) => `<div style="font-weight:bold;letter-spacing:0.5px;margin-top:6px">${escapeHtml(text)}</div>`
  const reasons = sangriasByReason(movements)

  const lines = [
    `<div style="text-align:center;font-weight:bold;font-size:14px">${escapeHtml(restaurant)}</div>`,
    `<div style="text-align:center">${escapeHtml(reportTitle(report))}</div>`,
    rule,
    row('Aberto por', session.openedBy),
    row('Abertura', formatDateTime(session.openedAt)),
    session.closedAt ? row('Fechado por', session.closedBy ?? '') : '',
    session.closedAt ? row('Fechamento', formatDateTime(session.closedAt)) : row('Emitido em', formatDateTime(report.period.end)),
    rule,
    heading('VENDAS'),
    ...sales.byPayment.map((item) => row(`${item.method} (${item.count})`, formatCurrency(item.total))),
    row(`TOTAL (${sales.count})`, formatCurrency(sales.gross), true),
    row('Produtos', formatCurrency(sales.products)),
    row('Taxas de entrega', formatCurrency(sales.deliveryFees)),
    cancelled.count > 0 ? row(`Cancelados (${cancelled.count})`, formatCurrency(cancelled.total)) : '',
    pix.unconfirmedCount > 0 ? row(`Pix sem confirmação (${pix.unconfirmedCount})`, formatCurrency(pix.unconfirmedTotal)) : '',
    rule,
    heading('DINHEIRO NO CAIXA'),
    row('Fundo de troco', formatCurrency(cash.openingFloat)),
    row('Vendas em dinheiro (gaveta)', formatCurrency(figures.drawerSales)),
    figures.acertos > 0 ? row('Acertos de entregadores', formatCurrency(figures.acertos)) : '',
    row('Suprimentos', formatCurrency(cash.suprimentos)),
    row('Sangrias', `- ${formatCurrency(cash.sangrias)}`),
    row('ESPERADO', formatCurrency(cash.expected), true),
    session.countedCash !== null ? row('CONTADO', formatCurrency(session.countedCash), true) : '',
    session.difference !== null ? row('DIFERENÇA', `${session.difference > 0 ? '+' : ''}${formatCurrency(session.difference)}`, true) : '',
    session.closingNote ? `<div style="margin-top:4px">Obs.: ${escapeHtml(session.closingNote)}</div>` : '',
    figures.outstanding > 0 ? `${rule}${heading('AINDA COM ENTREGADORES')}${(report.couriers?.outstanding ?? []).map((courier) => row(`${courier.name || 'Sem nome'} (${courier.count})`, formatCurrency(courier.total))).join('')}` : '',
    reasons.length > 0 ? `${rule}${heading('SANGRIAS POR MOTIVO')}${reasons.map(([label, total]) => row(label, formatCurrency(total))).join('')}` : '',
    movements.length > 0 ? `${rule}${heading('MOVIMENTAÇÕES')}` : '',
    ...movements.map((item) => row(`${formatDateTime(item.createdAt)} ${movementTitle(item)}${item.voided ? ' (estornada)' : ''}`, `${item.voided ? '' : `${item.kind === 'sangria' ? '-' : '+'} `}${formatCurrency(item.amount)}`)),
    rule,
    '<div style="margin-top:28px;text-align:center">________________________________<br/>Responsável</div>',
  ].filter(Boolean).join('')

  const printWindow = window.open('', '_blank', 'width=360,height=700')
  if (!printWindow) return false
  printWindow.document.write(`<html><head><title>${escapeHtml(reportTitle(report))}</title></head><body style="margin:0;padding:10px;font-family:'Courier New',monospace;font-size:12px;max-width:300px;margin:0 auto">${lines}</body></html>`)
  printWindow.document.close()
  printWindow.focus()
  setTimeout(() => {
    printWindow.print()
    printWindow.close()
  }, 300)
  return true
}

const stamp = (iso: string | null) => (iso ? new Date(iso).toISOString().slice(0, 16).replace('T', '_').replace(':', 'h') : 'caixa')

/** Planilha de um caixa: vendas, dinheiro, sangrias por motivo, movimentações e dinheiro com entregadores. */
export function downloadCashReportCsv(report: CashReport) {
  const { session, sales, cash, pix, cancelled, movements } = report
  const figures = cashFigures(report)
  const pair = (label: string, value: string) => csvRow([csvText(label), value])
  const lines: string[] = [
    pair('Relatório', csvText(reportTitle(report))),
    pair('Aberto por', csvText(session.openedBy)),
    pair('Abertura', csvText(formatDateTime(session.openedAt))),
    ...(session.closedAt ? [pair('Fechado por', csvText(session.closedBy ?? '')), pair('Fechamento', csvText(formatDateTime(session.closedAt)))] : []),
    '',
    csvText('VENDAS POR FORMA DE PAGAMENTO'),
    csvRow([csvText('Forma'), csvText('Pedidos'), csvText('Total')]),
    ...sales.byPayment.map((item) => csvRow([csvText(item.method), String(item.count), csvNumber(item.total)])),
    csvRow([csvText('Total vendido'), String(sales.count), csvNumber(sales.gross)]),
    pair('Produtos', csvNumber(sales.products)),
    pair('Taxas de entrega', csvNumber(sales.deliveryFees)),
    pair('Cancelados (pedidos)', String(cancelled.count)),
    pair('Cancelados (valor)', csvNumber(cancelled.total)),
    pair('Pix sem confirmação (pedidos)', String(pix.unconfirmedCount)),
    '',
    csvText('POR TIPO DE PEDIDO'),
    csvRow([csvText('Tipo'), csvText('Pedidos'), csvText('Total')]),
    ...sales.bySource.map((item) => csvRow([csvText(item.source), String(item.count), csvNumber(item.total)])),
    '',
    csvText('DINHEIRO NO CAIXA'),
    pair('Fundo de troco', csvNumber(cash.openingFloat)),
    pair('Vendas em dinheiro na gaveta', csvNumber(figures.drawerSales)),
    pair('Vendas em dinheiro com entregadores', csvNumber(figures.courierSales)),
    pair('Acertos de entregadores', csvNumber(figures.acertos)),
    pair('Suprimentos', csvNumber(cash.suprimentos)),
    pair('Sangrias', csvNumber(cash.sangrias)),
    pair('Esperado no caixa', csvNumber(cash.expected)),
    ...(session.countedCash !== null ? [pair('Contado', csvNumber(session.countedCash))] : []),
    ...(session.difference !== null ? [pair('Diferença', csvNumber(session.difference))] : []),
    '',
    csvText('SANGRIAS POR MOTIVO'),
    csvRow([csvText('Motivo'), csvText('Total')]),
    ...sangriasByReason(movements).map(([label, total]) => csvRow([csvText(label), csvNumber(total)])),
    '',
    csvText('MOVIMENTAÇÕES'),
    csvRow(['Hora', 'Tipo', 'Motivo', 'Valor', 'Responsável', 'Observação', 'Situação'].map(csvText)),
    ...movements.map((item) => csvRow([
      csvText(formatDateTime(item.createdAt)),
      csvText(item.kind === 'sangria' ? 'Sangria' : item.kind === 'suprimento' ? 'Suprimento' : 'Acerto'),
      csvText(reasonLabel(item.kind, item.reason)),
      csvNumber(item.kind === 'sangria' ? -item.amount : item.amount),
      csvText(item.createdBy),
      csvText(item.note ?? ''),
      csvText(item.voided ? 'Estornada' : 'Válida'),
    ])),
    '',
    csvText('DINHEIRO AINDA COM ENTREGADORES'),
    csvRow([csvText('Entregador'), csvText('Pedidos'), csvText('Valor')]),
    ...(report.couriers?.outstanding ?? []).map((courier) => csvRow([csvText(courier.name || 'Sem entregador informado'), String(courier.count), csvNumber(courier.total)])),
  ]
  downloadCsv(`caixa_${stamp(session.openedAt)}.csv`, lines)
}

/** Planilha com todos os caixas fechados (uma linha por caixa). */
export function downloadCashHistoryCsv(sessions: CashSessionSummary[]) {
  const lines = [
    csvRow(['Abertura', 'Fechamento', 'Aberto por', 'Fechado por', 'Fundo de troco', 'Pedidos', 'Total vendido', 'Esperado', 'Contado', 'Diferença'].map(csvText)),
    ...sessions.map((item) => csvRow([
      csvText(formatDateTime(item.openedAt)),
      csvText(formatDateTime(item.closedAt)),
      csvText(item.openedBy),
      csvText(item.closedBy ?? ''),
      csvNumber(item.openingFloat),
      String(item.salesCount),
      csvNumber(item.gross),
      csvNumber(item.expectedCash ?? 0),
      csvNumber(item.countedCash ?? 0),
      csvNumber(item.difference ?? 0),
    ])),
  ]
  downloadCsv(`historico-de-caixas_${new Date().toISOString().slice(0, 10)}.csv`, lines)
}
