import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { courierLinkErrorMessage, createCourierLink } from '@/lib/delivery-api'
import { getCourierUrl } from '@/lib/public-order-url'

type CourierLinkDialogProps = {
  orderId: number
  courierName: string | null
  /** true quando o entregador já iniciou a entrega (o link atual está em uso). */
  started: boolean
  onClose: () => void
}

/**
 * Recupera o acesso do entregador a uma entrega em andamento. O servidor guarda só o hash do token,
 * então o link antigo não pode ser exibido de novo: gera-se um novo, e o anterior deixa de funcionar.
 */
export function CourierLinkDialog({ orderId, courierName, started, onClose }: CourierLinkDialogProps) {
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const generate = async () => {
    setBusy(true)
    try {
      setUrl(getCourierUrl(await createCourierLink(orderId)))
    } catch (error) {
      toast.error(courierLinkErrorMessage(error))
    } finally {
      setBusy(false)
    }
  }

  const copy = async () => {
    if (!url) return
    try {
      await navigator.clipboard.writeText(url)
      toast.success('Link copiado.')
    } catch {
      toast.error('Não foi possível copiar. Selecione e copie o link manualmente.')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <div className="grid gap-5">
        <h3 className="pr-8 font-heading text-2xl font-bold text-slate-900">Link do pedido #{orderId}</h3>
        {url === null ? (
          <div className="grid gap-4">
            <p className="text-sm text-slate-500">
              Por segurança o link antigo não pode ser exibido de novo. Vamos gerar um novo{courierName ? ` para ${courierName}` : ''}; o anterior deixa de funcionar.
            </p>
            {started ? (
              <p className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                A entrega já começou. Se o entregador ainda estiver com a página aberta, ela para de enviar a localização até ele abrir o link novo.
              </p>
            ) : null}
            <Button onClick={() => void generate()} disabled={busy}>{busy ? 'Gerando...' : 'Gerar novo link'}</Button>
          </div>
        ) : (
          <div className="grid gap-4">
            <p className="text-sm text-slate-500">Envie ao entregador. Ele abre no celular{started ? ' e a entrega continua de onde parou' : ' e toca em "Iniciar entrega"'}.</p>
            <Input readOnly value={url} onFocus={(event) => event.currentTarget.select()} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="outline" onClick={() => void copy()}>Copiar link</Button>
              <Button onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`Entrega do pedido #${orderId}: ${url}`)}`, '_blank', 'noopener,noreferrer')}>Enviar pelo WhatsApp</Button>
            </div>
          </div>
        )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
