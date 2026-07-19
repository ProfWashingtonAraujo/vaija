import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'default' | 'secondary' | 'ghost' | 'outline'
}

export function Button({ className, variant = 'default', ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center rounded-2xl border px-4 py-2.5 text-sm font-semibold transition-all duration-200 active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-orange-200 disabled:cursor-not-allowed disabled:opacity-60',
        variant === 'default' &&
          'border-orange-500 bg-orange-500 text-white shadow-[0_10px_30px_rgba(255,107,0,0.24)] hover:-translate-y-0.5 hover:bg-orange-600',
        variant === 'secondary' &&
          'border-orange-200 bg-orange-50 text-orange-700 hover:border-orange-300 hover:bg-orange-100',
        variant === 'outline' && 'border-orange-200 bg-white text-slate-800 hover:border-orange-400 hover:text-orange-700',
        variant === 'ghost' && 'border-transparent bg-transparent text-slate-700 hover:bg-orange-50 hover:text-orange-700',
        className,
      )}
      {...props}
    />
  )
}
