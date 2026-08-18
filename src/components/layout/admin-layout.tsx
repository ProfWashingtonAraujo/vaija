import type { PropsWithChildren } from 'react'
import { motion } from 'framer-motion'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader } from '@/components/layout/app-header'
import { PageContainer } from '@/components/layout/page-container'

export function AdminLayout({ title, description, children }: PropsWithChildren<{ title: string; description: string }>) {
  return (
    <div className="min-h-screen bg-background py-3 sm:py-4 lg:py-6">
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-[272px_minmax(0,1fr)]">
          <div className="hidden lg:block">
            <AppSidebar />
          </div>
          <motion.main initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="min-w-0">
            <AppHeader title={title} description={description} />
            {children}
          </motion.main>
        </div>
      </PageContainer>
    </div>
  )
}
