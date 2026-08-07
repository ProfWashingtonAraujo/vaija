import { useState } from 'react'
import type { Order } from '@/data/mock-orders'
import { Button } from '@/components/ui/button'
import { StatusBadge } from '@/components/shared/status-badge'
import { formatCurrency } from '@/lib/formatters'
import { readSettings } from '@/lib/settings'

function buildCupomHtml(order: Order, includeLogo = false) {
  const settings = readSettings().restaurant
  const source = order.source ?? 'Online'
  const deliveryFee = order.deliveryFee ?? (source === 'Online' ? 8 : 0)
  const subtotal = order.value - deliveryFee
  const now = new Date()
  const dateStr = now.toLocaleDateString('pt-BR')
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

  const logoHtml = includeLogo && settings.logo
    ? `<div style="text-align:center;margin-bottom:8px"><img src="${settings.logo}" style="max-width:160px;max-height:70px;object-fit:contain" /></div>`
    : ''

  return `
    ${logoHtml}
    <div style="text-align:center;font-weight:bold;font-size:15px;letter-spacing:1px">${settings.name.toUpperCase()}</div>
    ${settings.phone ? `<div style="text-align:center;font-size:11px;color:#555">${settings.phone}</div>` : ''}
    <div style="border-top:2px dashed #ccc;margin:12px 0"></div>
    <div style="text-align:center;font-weight:bold;font-size:11px;letter-spacing:0.5px">--- CUPOM NAO FISCAL ---</div>
    <div style="margin-top:10px;font-size:11px">
      <div><b>Pedido:</b> #${order.id}</div>
      <div><b>Data:</b> ${dateStr}  <b>Hora:</b> ${timeStr}</div>
    </div>
    <div style="border-top:1px dashed #ccc;margin:10px 0"></div>
    <div style="font-weight:bold;font-size:11px;letter-spacing:0.5px">ITENS</div>
    <div style="margin-top:6px">
      ${order.items.map((item, i) => `<div style="padding:3px 0;font-size:11px;border-bottom:1px dotted #eee">${i + 1}. ${item}</div>`).join('')}
    </div>
    <div style="border-top:1px dashed #ccc;margin:10px 0"></div>
    <div style="font-size:11px">
      <div style="display:flex;justify-content:space-between;padding:2px 0"><span>Subtotal</span><span>${formatCurrency(subtotal)}</span></div>
      <div style="display:flex;justify-content:space-between;padding:2px 0"><span>${source === 'Mesa' ? 'Taxa mesa' : 'Taxa entrega'}</span><span>${formatCurrency(deliveryFee)}</span></div>
    </div>
    <div style="border-top:2px solid #333;margin:8px 0"></div>
    <div style="display:flex;justify-content:space-between;font-weight:bold;font-size:14px;padding:4px 0">
      <span>TOTAL</span>
      <span>${formatCurrency(order.value)}</span>
    </div>
    <div style="border-bottom:2px solid #333;margin:8px 0"></div>
    <div style="font-size:11px;margin-top:8px">
      <div><b>Pagamento:</b> ${order.payment}</div>
      ${order.phone ? `<div><b>Telefone:</b> ${order.phone}</div>` : ''}
      ${order.address ? `<div><b>Endereco:</b> ${order.address}</div>` : ''}
      ${order.tableNumber ? `<div><b>Mesa:</b> ${order.tableNumber}</div>` : ''}
    </div>
    ${order.notes ? `<div style="margin-top:8px;padding:6px;border:1px dashed #999;font-size:10px;background:#fffdf5"><b>OBS:</b> ${order.notes}</div>` : ''}
    <div style="border-top:2px dashed #ccc;margin:12px 0"></div>
    <div style="text-align:center;font-size:10px;color:#666">Obrigado pela preferencia!</div>
    <div style="text-align:center;font-size:10px;font-weight:bold;color:#333;margin-top:2px">${settings.name}</div>
  `
}

function CupomPreview({ order, onPrint, onClose }: { order: Order; onPrint: () => void; onClose: () => void }) {
  const settings = readSettings().restaurant
  const cupomHtml = buildCupomHtml(order, false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-sm overflow-y-auto rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.15)]" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-heading text-xl font-bold text-slate-900">Preview do Cupom</h3>
          <button onClick={onClose} className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        <div className="rounded-2xl border border-orange-100 bg-[#fffdf9] p-5 shadow-inner">
          {settings.logo && (
            <div className="mb-2 flex justify-center">
              <img src={settings.logo} alt={settings.name} className="max-h-20 object-contain" />
            </div>
          )}
          <div className="font-mono text-xs leading-relaxed text-slate-700" dangerouslySetInnerHTML={{ __html: cupomHtml }} />
        </div>

        <div className="mt-5 flex gap-3">
          <Button variant="outline" className="flex-1 border-orange-200" onClick={onClose}>Cancelar</Button>
          <Button className="flex-1" onClick={onPrint}>Imprimir</Button>
        </div>
      </div>
    </div>
  )
}

function printCupom(order: Order) {
  const cupomHtml = buildCupomHtml(order, true)

  const printWindow = window.open('', '_blank', 'width=320,height=600')
  if (printWindow) {
    printWindow.document.write(`
      <html>
        <head><title>Cupom #${order.id}</title></head>
        <body style="margin:0;padding:10px;font-family:'Courier New',monospace;font-size:12px;max-width:280px;margin:0 auto">
          ${cupomHtml}
        </body>
      </html>
    `)
    printWindow.document.close()
    printWindow.focus()
    setTimeout(() => {
      printWindow.print()
      printWindow.close()
    }, 300)
  }
}

export function OrderDetailsPanel({ order, onAdvance, onEdit, onOpenWhatsapp }: { order: Order; onAdvance: () => void; onEdit: () => void; onOpenWhatsapp: () => void }) {
  const [showPreview, setShowPreview] = useState(false)
  const source = order.source ?? 'Online'
  const deliveryFee = order.deliveryFee ?? (source === 'Online' ? 8 : 0)
  const subtotal = order.value - deliveryFee
  const nextStepLabel = order.status === 'Pendente' ? 'Avançar para Produção' : order.status === 'Em producao' ? 'Marcar como Pronto' : 'Finalizar Pedido'
  const canManageOrder = order.status === 'Pendente' || order.status === 'Em producao'

  return (
    <>
      <div className="rounded-[30px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-sm font-semibold text-slate-500">Pedido #{order.id}</p>
            <h3 className="mt-2 font-heading text-2xl font-bold text-slate-900">{order.customer}</h3>
          </div>
          <StatusBadge status={order.status} />
        </div>
        <div className="mt-6 space-y-4 text-sm text-slate-600">
          <p><span className="font-semibold text-slate-900">Telefone:</span> {order.phone}</p>
          <p><span className="font-semibold text-slate-900">Tipo:</span> {source}</p>
          {source === 'Mesa' ? (
            <p><span className="font-semibold text-slate-900">Mesa:</span> {order.tableNumber ?? 'Não informada'}</p>
          ) : (
            <p><span className="font-semibold text-slate-900">Endereço:</span> {order.address}</p>
          )}
          <div>
            <p className="font-semibold text-slate-900">Itens</p>
            <ul className="mt-2 space-y-2">
              {order.items.map((item) => <li key={item} className="rounded-2xl border border-orange-100 bg-white/90 px-3 py-2">{item}</li>)}
            </ul>
          </div>
          {order.notes ? (
            <div className="rounded-[24px] border border-amber-200 bg-amber-50/70 p-4 text-amber-800">
              <p className="font-semibold">Observação do cliente</p>
              <p className="mt-2 leading-6">{order.notes}</p>
            </div>
          ) : null}
          <div className="space-y-2 rounded-[24px] border border-orange-100 bg-white/80 p-4 shadow-[0_10px_24px_rgba(255,107,0,0.05)]">
            <div className="flex justify-between"><span>Subtotal</span><span className="font-mono">{formatCurrency(subtotal)}</span></div>
            <div className="flex justify-between"><span>{source === 'Mesa' ? 'Taxa de mesa' : 'Taxa de entrega'}</span><span className="font-mono">{formatCurrency(deliveryFee)}</span></div>
            <div className="flex justify-between text-base font-semibold text-slate-900"><span>Total</span><span className="font-mono">{formatCurrency(order.value)}</span></div>
            <div className="flex justify-between"><span>Pagamento</span><span>{order.payment}</span></div>
          </div>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {canManageOrder ? <Button variant="outline" className="border-orange-200 bg-white/90" onClick={onEdit}>Editar pedido</Button> : null}
          {canManageOrder ? <Button variant="secondary" onClick={onOpenWhatsapp}>Conversar no WhatsApp</Button> : null}
          <Button variant="outline" className="border-orange-200 bg-white/90" onClick={() => setShowPreview(true)}>Imprimir Cupom</Button>
          <Button onClick={onAdvance}>{nextStepLabel}</Button>
        </div>
      </div>

      {showPreview && (
        <CupomPreview
          order={order}
          onPrint={() => { printCupom(order); setShowPreview(false) }}
          onClose={() => setShowPreview(false)}
        />
      )}
    </>
  )
}
