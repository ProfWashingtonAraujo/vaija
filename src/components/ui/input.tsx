import type { InputHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none transition-all duration-200 placeholder:text-slate-400 focus:-translate-y-px focus:border-orange-400 focus:ring-4 focus:ring-orange-100',
        className,
      )}
      {...props}
    />
  )
}
