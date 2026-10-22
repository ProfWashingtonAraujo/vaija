import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { formatCurrency } from '@/lib/formatters'

export type PayTarget = { name: string; pending: number; count: number }

/** Registro do pagamento do repasse: pode sair do dinheiro do caixa (vira uma sangria) ou ser pago por fora. */
export function PayCourierDialog({ target, cashOpen, busy, onClose, onConfirm }: { target: PayTarget | null; cashOpen: boolean; busy: boolean; onClose: () => void; onConfirm: (fromCash: boolean) => void }) {
  const [fromCash, setFromCash] = useState(false)

  useEffect(() => {
    if (target) setFromCash(cashOpen)
  }, [target, cashOpen])

  const who = target?.name || 'o entregador'
  return (
    <Dialog open={target !== null} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-md">
        <div className="grid gap-5">
          <div>
            <DialogTitle className="pr-8 font-heading text-2xl font-bold text-sa-text">Registrar pagamento</DialogTitle>
            <DialogDescription className="mt-2 text-sm leading-6 text-sa-muted">
              Registrar que {who} recebeu {formatCurrency(target?.pending ?? 0)} por {target?.count ?? 0} {target?.count === 1 ? 'entrega' : 'entregas'} deste período. Você pode desfazer depois, se registrar por engano.
            </DialogDescription>
          </div>
          <label className={`flex items-start gap-3 rounded-2xl border p-4 text-sm ${cashOpen ? 'cursor-pointer border-sa-border bg-sa-surface-2' : 'border-sa-border bg-sa-surface-2 text-sa-soft'}`}>
            <input type="checkbox" checked={fromCash} disabled={!cashOpen} onChange={(event) => setFromCash(event.target.checked)} className="mt-0.5 h-4 w-4 accent-sa-accent" />
            <span>
              <span className="block font-semibold text-sa-text">Pagar com dinheiro do caixa</span>
              <span className="block text-sa-muted">{cashOpen ? `Registra uma sangria de ${formatCurrency(target?.pending ?? 0)} no caixa aberto, para o dinheiro esperado na gaveta continuar certo.` : 'O caixa está fechado. Abra o caixa para pagar com o dinheiro da gaveta.'}</span>
            </span>
          </label>
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>Cancelar</Button>
            <Button disabled={busy} onClick={() => onConfirm(fromCash)}>{busy ? 'Registrando...' : 'Registrar pagamento'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
