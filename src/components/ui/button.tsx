import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'ghost' | 'outline'
}

export function Button({ className, variant = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-sa-accent/30 disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'default' &&
          'border-sa-accent bg-sa-accent text-white shadow-[0_8px_18px_rgba(255,107,0,0.25)] hover:opacity-90',
        variant === 'secondary' &&
          'border-sa-border-strong bg-sa-accent-soft text-sa-accent-text hover:opacity-90',
        variant === 'outline' && 'border-sa-border bg-sa-surface text-sa-text hover:border-sa-border-strong hover:text-sa-accent-text',
        variant === 'ghost' && 'border-transparent bg-transparent text-sa-text-2 hover:bg-sa-hover hover:text-sa-accent-text',
        className,
      )}
      {...props}
    />
  )
}
