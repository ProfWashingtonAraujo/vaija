import { useState, type PropsWithChildren } from 'react'
import { motion } from 'framer-motion'
import { SaasHeader } from '@/components/layout/saas-header'
import { SaasSidebar } from '@/components/layout/saas-sidebar'
import { useSaasTheme } from '@/lib/saas-theme'

const collapsedKey = 'vaija.saas.sidebarCollapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(collapsedKey) === 'true'
  } catch {
    return false
  }
}

export function SaasLayout({ title, description, children }: PropsWithChildren<{ title: string; description: string }>) {
  const { theme, setTheme } = useSaasTheme()
  const [collapsed, setCollapsed] = useState(readCollapsed)

  const toggleSidebar = () => {
    const next = !collapsed
    setCollapsed(next)
    try {
      localStorage.setItem(collapsedKey, String(next))
    } catch {
      // preferência não guardada
    }
  }

  return (
    <div className="saas-shell flex min-h-screen bg-sa-bg text-sa-text">
      <div className="sticky top-0 z-30 hidden h-screen shrink-0 lg:block">
        <SaasSidebar collapsed={collapsed} onToggle={toggleSidebar} />
      </div>
      <div className="min-w-0 flex-1">
        <SaasHeader title={title} description={description} theme={theme} onThemeChange={setTheme} />
        <motion.main initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto w-full max-w-[1600px] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
          {children}
        </motion.main>
      </div>
    </div>
  )
}
