import type { PropsWithChildren } from 'react'
import { cn } from '@/lib/utils'

export function PageContainer({ children, className }: PropsWithChildren<{ className?: string }>) {
  return <div className={cn('mx-auto w-full max-w-none px-4 sm:px-6 lg:px-8', className)}>{children}</div>
}
