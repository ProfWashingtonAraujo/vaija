import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Copy } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/formatters'
import { buildPixPayload, isPixConfigured, type PixConfig } from '@/lib/pix'

type PixPaymentCardProps = {
  config: PixConfig
  orderId: number
  amount: number
  paid: boolean
}

/** Pagamento por Pix do pedido: QR Code e copia-e-cola gerados com a chave da loja, ou a confirmação quando já foi pago. */
export function PixPaymentCard({ config, orderId, amount, paid }: PixPaymentCardProps) {
  const configured = isPixConfigured(config)
  const payload = useMemo(
    () => (configured ? buildPixPayload({ config, amount, txid: `VAIJA${orderId}` }) : ''),
    [configured, config, amount, orderId],
  )
  const [qr, setQr] = useState<string | null>(null)

  useEffect(() => {
    if (!payload || paid) return
    let active = true
    // a biblioteca do QR Code só carrega quando o cliente realmente precisa pagar
    void import('qrcode')
      .then((module) => module.toDataURL(payload, { margin: 1, width: 240, errorCorrectionLevel: 'M' }))
      .then((url) => { if (active) setQr(url) })
      .catch(() => { if (active) setQr(null) })
    return () => { active = false }
  }, [payload, paid])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(payload)
      toast.success('Código Pix copiado. Cole no app do seu banco.')
    } catch {
      toast.error('Não foi possível copiar. Selecione o código e copie manualmente.')
    }
  }

  if (paid) {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-[24px] border border-emerald-200 bg-emerald-50 p-4 text-emerald-800">
        <CheckCircle2 className="h-6 w-6 shrink-0" />
        <div>
          <p className="font-semibold">Pagamento confirmado</p>
          <p className="text-sm">O restaurante recebeu o seu Pix. Obrigado!</p>
        </div>
      </div>
    )
  }

  if (!configured) return null

  return (
    <div className="mt-6 rounded-[24px] border border-orange-200 bg-orange-50/50 p-5">
      <h3 className="font-heading text-xl font-bold text-slate-900">Pague com Pix</h3>
      <p className="mt-1 text-sm text-slate-600">Valor do pedido: <span className="font-mono font-semibold text-slate-900">{formatCurrency(amount)}</span></p>
      <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <div className="flex h-[240px] w-[240px] shrink-0 items-center justify-center rounded-2xl border border-orange-100 bg-white p-2">
          {qr ? <img src={qr} alt="QR Code do Pix" width={224} height={224} className="h-56 w-56" /> : <span className="text-sm text-slate-400">Gerando QR Code...</span>}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <ol className="list-decimal space-y-1 pl-5 text-sm leading-6 text-slate-600">
            <li>Abra o app do seu banco e escolha pagar com Pix.</li>
            <li>Leia o QR Code ou use o Pix Copia e Cola.</li>
            <li>Confira o valor e o nome do recebedor e confirme.</li>
          </ol>
          <textarea readOnly value={payload} onFocus={(event) => event.currentTarget.select()} aria-label="Código Pix copia e cola" className="h-24 w-full resize-none rounded-2xl border border-orange-100 bg-white p-3 font-mono text-xs text-slate-600 outline-none" />
          <Button type="button" onClick={() => void copy()} className="w-full sm:w-auto"><Copy className="mr-2 h-4 w-4" />Copiar código Pix</Button>
          <p className="text-xs leading-5 text-slate-500">Depois de pagar, o restaurante confere e confirma o seu pedido. Esta página atualiza sozinha.</p>
        </div>
      </div>
    </div>
  )
}
