import type { PropsWithChildren } from 'react'
import { motion } from 'framer-motion'
import { PageContainer } from '@/components/layout/page-container'
import { SaasHeader } from '@/components/layout/saas-header'
import { SaasSidebar } from '@/components/layout/saas-sidebar'

export function SaasLayout({ title, description, children }: PropsWithChildren<{ title: string; description: string }>) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(255,178,107,0.18),transparent_30%),#fffdf8] py-3 sm:py-4 lg:py-6">
      <PageContainer>
        <div className="grid gap-6 lg:grid-cols-[272px_minmax(0,1fr)]">
          <div className="hidden lg:block">
            <SaasSidebar />
          </div>
          <motion.main initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="min-w-0">
            <SaasHeader title={title} description={description} />
            {children}
          </motion.main>
        </div>
      </PageContainer>
    </div>
  )
}
