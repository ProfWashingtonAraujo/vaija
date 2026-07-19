import type { ComponentProps } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function GlowButton({ className, ...props }: ComponentProps<typeof Button>) {
  return <Button className={cn('shadow-[0_16px_40px_rgba(255,107,0,0.22)]', className)} {...props} />
}
