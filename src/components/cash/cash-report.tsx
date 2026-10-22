import { AlertTriangle } from 'lucide-react'
import { reasonLabel, type CashReport } from '@/lib/cash-api'
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

const reportTitle = (report: CashReport) => (report.session.closedAt ? 'Fechamento de caixa (leitura Z)' : 'Leitura X (parcial)')

function Line({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: 'plus' | 'minus' }) {
  return (
    <div className={cn('flex justify-between gap-3', strong && 'text-base font-semibold text-slate-900')}>
      <span className={cn(tone === 'minus' && 'text-rose-700', tone === 'plus' && 'text-emerald-700')}>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  )
}

/** Relatório do caixa: serve para a leitura X (ao vivo), o fechamento (Z) e o histórico. */
export function CashReportView({ report }: { report: CashReport }) {
  const { session, sales, cash, pix, cancelled, movements } = report
  const closed = session.closedAt !== null

  return (
    <div className="space-y-5 text-sm text-slate-600">
      <div className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
        <p className="font-semibold text-slate-900">{reportTitle(report)}</p>
        <p className="mt-1">Aberto por {session.openedBy} em {formatDateTime(session.openedAt)}</p>
        {closed ? <p>Fechado por {session.closedBy} em {formatDateTime(session.closedAt)}</p> : <p>Emitido em {formatDateTime(report.period.end)}</p>}
        {session.openingNote ? <p className="mt-1 text-slate-500">Obs. da abertura: {session.openingNote}</p> : null}
      </div>

      {pix.unconfirmedCount > 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{pix.unconfirmedCount} {pix.unconfirmedCount === 1 ? 'pedido Pix' : 'pedidos Pix'} ({formatCurrency(pix.unconfirmedTotal)}) finalizado{pix.unconfirmedCount === 1 ? '' : 's'} sem confirmação de pagamento. Confira no app do banco.</p>
        </div>
      ) : null}

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Vendas por forma de pagamento</h4>
        <div className="space-y-1.5 rounded-2xl border border-orange-100 bg-white p-4">
          {sales.byPayment.map((row) => <Line key={row.method} label={`${row.method} · ${row.count} ${row.count === 1 ? 'pedido' : 'pedidos'}`} value={formatCurrency(row.total)} />)}
          <div className="border-t border-orange-100 pt-2">
            <Line label={`Total vendido · ${sales.count} ${sales.count === 1 ? 'pedido' : 'pedidos'}`} value={formatCurrency(sales.gross)} strong />
          </div>
          <p className="pt-1 text-xs text-slate-500">Produtos {formatCurrency(sales.products)} + taxas de entrega {formatCurrency(sales.deliveryFees)}</p>
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Por tipo de pedido</h4>
        <div className="space-y-1.5 rounded-2xl border border-orange-100 bg-white p-4">
          {sales.bySource.map((row) => <Line key={row.source} label={`${row.source} · ${row.count}`} value={formatCurrency(row.total)} />)}
          {cancelled.count > 0 ? <div className="border-t border-orange-100 pt-2"><Line label={`Cancelados (não entram no total) · ${cancelled.count}`} value={formatCurrency(cancelled.total)} /></div> : null}
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Dinheiro no caixa</h4>
        <div className="space-y-1.5 rounded-2xl border border-orange-100 bg-white p-4">
          <Line label="Fundo de troco" value={formatCurrency(cash.openingFloat)} />
          <Line label="Vendas em dinheiro" value={`+ ${formatCurrency(cash.cashSales)}`} tone="plus" />
          <Line label="Suprimentos" value={`+ ${formatCurrency(cash.suprimentos)}`} tone="plus" />
          <Line label="Sangrias" value={`− ${formatCurrency(cash.sangrias)}`} tone="minus" />
          <div className="border-t border-orange-100 pt-2">
            <Line label="Esperado no caixa" value={formatCurrency(cash.expected)} strong />
          </div>
          {closed && session.countedCash !== null && session.difference !== null ? (
            <>
              <Line label="Contado" value={formatCurrency(session.countedCash)} />
              <p className={cn('rounded-xl px-3 py-2 text-center font-semibold', Math.abs(session.difference) < 0.005 ? 'bg-emerald-50 text-emerald-700' : session.difference > 0 ? 'bg-sky-50 text-sky-700' : 'bg-rose-50 text-rose-700')}>{differenceLabel(session.difference)}</p>
              {session.closingNote ? <p className="text-xs text-slate-500">Obs. do fechamento: {session.closingNote}</p> : null}
            </>
          ) : null}
        </div>
      </section>

      <section>
        <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Sangrias e suprimentos</h4>
        {movements.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/50 p-3 text-center">Nenhuma movimentação neste caixa.</p> : (
          <ul className="divide-y divide-orange-50 rounded-2xl border border-orange-100 bg-white">
            {movements.map((movement) => (
              <li key={movement.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{movement.kind === 'sangria' ? 'Sangria' : 'Suprimento'} · {reasonLabel(movement.kind, movement.reason)}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(movement.createdAt)} · {movement.createdBy}{movement.note ? ` · ${movement.note}` : ''}</p>
                </div>
                <span className={cn('shrink-0 font-mono font-semibold', movement.kind === 'sangria' ? 'text-rose-700' : 'text-emerald-700')}>{movement.kind === 'sangria' ? '−' : '+'} {formatCurrency(movement.amount)}</span>
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
  const restaurant = readSettings().restaurant.name
  const row = (label: string, value: string, bold = false) =>
    `<div style="display:flex;justify-content:space-between;gap:8px;padding:2px 0;${bold ? 'font-weight:bold;font-size:13px' : ''}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`
  const rule = '<div style="border-top:1px dashed #999;margin:8px 0"></div>'
  const heading = (text: string) => `<div style="font-weight:bold;letter-spacing:0.5px;margin-top:6px">${escapeHtml(text)}</div>`

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
    row('Vendas em dinheiro', formatCurrency(cash.cashSales)),
    row('Suprimentos', formatCurrency(cash.suprimentos)),
    row('Sangrias', `- ${formatCurrency(cash.sangrias)}`),
    row('ESPERADO', formatCurrency(cash.expected), true),
    session.countedCash !== null ? row('CONTADO', formatCurrency(session.countedCash), true) : '',
    session.difference !== null ? row('DIFERENÇA', `${session.difference > 0 ? '+' : ''}${formatCurrency(session.difference)}`, true) : '',
    session.closingNote ? `<div style="margin-top:4px">Obs.: ${escapeHtml(session.closingNote)}</div>` : '',
    movements.length > 0 ? `${rule}${heading('MOVIMENTAÇÕES')}` : '',
    ...movements.map((item) => row(`${formatDateTime(item.createdAt)} ${item.kind === 'sangria' ? 'Sangria' : 'Suprimento'} · ${reasonLabel(item.kind, item.reason)}`, `${item.kind === 'sangria' ? '-' : '+'} ${formatCurrency(item.amount)}`)),
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
