import type { PropsWithChildren } from 'react'
import { motion } from 'framer-motion'
import { MobileTabBar } from '@/components/layout/mobile-tab-bar'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppHeader, PageTitle } from '@/components/layout/app-header'
import { SidebarProvider, useSidebar } from '@/components/layout/sidebar-context'
import { useStoreTheme } from '@/lib/saas-theme'
import { cn } from '@/lib/utils'

function LayoutInner({ title, description, children }: PropsWithChildren<{ title: string; description?: string }>) {
  const { collapsed } = useSidebar()
  const { theme, setTheme } = useStoreTheme()

  return (
    <div className="flex h-dvh overflow-hidden bg-sa-bg text-sa-text">
      {/* Sidebar — desktop only */}
      <div className={cn('relative z-50 hidden flex-shrink-0 transition-all duration-300 lg:flex', collapsed ? 'w-[76px]' : 'w-64')}>
        <AppSidebar />
      </div>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <AppHeader title={title} description={description ?? ''} theme={theme} onThemeChange={setTheme} />

        <motion.main
          key={title}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="flex-1 overflow-y-auto scrollbar-thin"
        >
          <PageTitle title={title} description={description} />
          <div className="px-4 pb-28 sm:px-6 lg:pb-8">{children}</div>
        </motion.main>
        <MobileTabBar />
      </div>
    </div>
  )
}

export function AdminLayout({
  title,
  description,
  children,
}: PropsWithChildren<{ title: string; description?: string }>) {
  return (
    <SidebarProvider>
      <LayoutInner title={title} description={description}>{children}</LayoutInner>
    </SidebarProvider>
  )
}
