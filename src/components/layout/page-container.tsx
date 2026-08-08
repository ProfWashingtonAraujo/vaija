import type { PropsWithChildren } from 'react'
import { cn } from '@/lib/utils'

export function PageContainer({ children, className, constrained = false }: PropsWithChildren<{ className?: string; constrained?: boolean }>) {
  return <div className={cn('mx-auto w-full px-4 sm:px-6 lg:px-8', constrained ? 'max-w-7xl' : 'max-w-none', className)}>{children}</div>
}
