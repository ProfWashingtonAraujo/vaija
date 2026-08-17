import type { ReactNode } from 'react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export function MobileDrawer({ trigger, children, side = 'right', open, onOpenChange }: { trigger: ReactNode; children: ReactNode; side?: 'right' | 'bottom'; open?: boolean; onOpenChange?: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        className={cn(
          'p-0',
          side === 'right' && 'left-auto right-0 top-0 h-screen w-[85vw] max-w-sm translate-x-0 translate-y-0 rounded-none rounded-l-[32px]',
          side === 'bottom' && 'left-1/2 top-auto bottom-0 max-h-[92dvh] w-full max-w-2xl -translate-x-1/2 translate-y-0 overflow-hidden rounded-b-none rounded-t-[28px] sm:w-[calc(100%-1rem)]',
        )}
      >
        {children}
      </DialogContent>
    </Dialog>
  )
}
