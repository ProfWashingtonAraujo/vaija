import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-xl border border-sa-border bg-sa-surface-2 px-4 text-sm text-sa-text outline-none transition-all duration-200 placeholder:text-sa-soft focus:border-sa-accent focus:ring-4 focus:ring-sa-accent/20',
        className,
      )}
      {...props}
    />
  )
}
