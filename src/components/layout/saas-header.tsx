import { useEffect, useState } from 'react'
import { Bell, Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { MobileDrawer } from '@/components/shared/mobile-drawer'
import { SaasSidebar } from '@/components/layout/saas-sidebar'
import { ThemeToggle } from '@/components/saas/theme-toggle'
import { fetchAllTickets } from '@/lib/support-api'
import { usePolling } from '@/lib/use-polling'
import type { SaasTheme } from '@/lib/saas-theme'

type HeaderProps = {
  title: string
  description: string
  theme: SaasTheme
  onThemeChange: (theme: SaasTheme) => void
}

export function SaasHeader({ title, description, theme, onThemeChange }: HeaderProps) {
  const { user } = useAuth()
  const [openTickets, setOpenTickets] = useState(0)

  const loadTickets = () => fetchAllTickets()
    .then((tickets) => setOpenTickets(tickets.filter((ticket) => ticket.status === 'Aberto').length))
    .catch(() => undefined)

  useEffect(() => {
    void loadTickets()
  }, [])

  usePolling(loadTickets, 60_000)

  const initials = (user?.name ?? 'Vaija').split(' ').slice(0, 2).map((part) => part[0]).join('').toUpperCase()

  return (
    <header className="sticky top-0 z-20 border-b border-sa-border bg-sa-bg/85 backdrop-blur-md">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="lg:hidden">
            <MobileDrawer trigger={<button type="button" aria-label="Abrir menu" className="flex h-10 w-10 items-center justify-center rounded-xl border border-sa-border bg-sa-surface text-sa-text"><Menu className="h-5 w-5" /></button>}>
              <div className="h-full"><SaasSidebar /></div>
            </MobileDrawer>
          </div>
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-bold leading-tight text-sa-text sm:truncate sm:text-2xl">{title}</h1>
            <p className="hidden truncate text-sm text-sa-muted sm:block">{description}</p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <ThemeToggle theme={theme} onChange={onThemeChange} />
          <Link to="/saas/suporte" aria-label={openTickets ? `${openTickets} chamado(s) aberto(s)` : 'Suporte'} title="Chamados de suporte" className="relative flex h-10 w-10 items-center justify-center rounded-full border border-sa-border bg-sa-surface text-sa-muted transition-colors hover:text-sa-text">
            <Bell className="h-[18px] w-[18px]" />
            {openTickets > 0 ? <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sa-accent px-1 text-[10px] font-bold text-white">{openTickets > 9 ? '9+' : openTickets}</span> : null}
          </Link>
          <div className="hidden items-center gap-3 rounded-full border border-sa-border bg-sa-surface py-1 pl-1 pr-4 sm:flex">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sa-accent-soft font-heading text-xs font-bold text-sa-accent-text">{initials}</div>
            <div className="hidden min-w-0 leading-tight sm:block">
              <p className="truncate text-sm font-semibold text-sa-text">{user?.name ?? 'Administrador'}</p>
              <p className="truncate text-xs text-sa-muted">{user?.username ?? 'admin'}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
