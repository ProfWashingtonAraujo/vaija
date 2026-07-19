import type { ReactNode } from 'react'
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export function ConfirmDialog({ trigger, title, description, onConfirm, confirmLabel = 'Confirmar', cancelLabel = 'Cancelar' }: { trigger: ReactNode; title: string; description: string; onConfirm: () => void; confirmLabel?: string; cancelLabel?: string }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <h3 className="font-heading text-2xl font-bold text-slate-900">{title}</h3>
        <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
        <div className="mt-6 flex justify-end gap-3">
          <DialogClose asChild>
            <Button variant="outline">{cancelLabel}</Button>
          </DialogClose>
          <DialogClose asChild>
            <Button onClick={onConfirm}>{confirmLabel}</Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  )
}
