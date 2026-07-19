import * as AccordionPrimitive from '@radix-ui/react-accordion'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Accordion = AccordionPrimitive.Root
export const AccordionItem = AccordionPrimitive.Item

export function AccordionTrigger({ className, children, ...props }: AccordionPrimitive.AccordionTriggerProps) {
  return (
    <AccordionPrimitive.Header>
      <AccordionPrimitive.Trigger
        className={cn(
          'flex w-full items-center justify-between gap-4 px-6 py-5 text-left font-semibold text-slate-900',
          className,
        )}
        {...props}
      >
        {children}
        <ChevronDown className="h-5 w-5 text-orange-500 transition data-[state=open]:rotate-180" />
      </AccordionPrimitive.Trigger>
    </AccordionPrimitive.Header>
  )
}

export function AccordionContent({ className, children, ...props }: AccordionPrimitive.AccordionContentProps) {
  return (
    <AccordionPrimitive.Content className={cn('px-6 pb-5 text-sm leading-7 text-slate-600', className)} {...props}>
      {children}
    </AccordionPrimitive.Content>
  )
}
