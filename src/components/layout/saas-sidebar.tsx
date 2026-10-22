import { Briefcase, Building2, ChevronLeft, ClipboardList, CreditCard, FileClock, Headphones, LayoutDashboard, LogOut, Users } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'

const groups = [
  {
    label: 'Principal',
    links: [
      { to: '/saas', label: 'Visão geral', icon: LayoutDashboard },
      { to: '/saas/clientes', label: 'Clientes', icon: Building2 },
      { to: '/saas/financeiro', label: 'Financeiro', icon: CreditCard },
      { to: '/saas/planos', label: 'Planos', icon: ClipboardList },
    ],
  },
  {
    label: 'Atendimento',
    links: [
      { to: '/saas/comercial', label: 'Comercial', icon: Briefcase },
      { to: '/saas/suporte', label: 'Suporte', icon: Headphones },
    ],
  },
  {
    label: 'Sistema',
    links: [
      { to: '/saas/equipe', label: 'Equipe', icon: Users },
      { to: '/saas/auditoria', label: 'Auditoria', icon: FileClock },
    ],
  },
]

export function SaasSidebar({ collapsed = false, onToggle }: { collapsed?: boolean; onToggle?: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuth()

  return (
    <aside className={cn('relative flex h-full flex-col border-r border-sa-border bg-sa-surface transition-[width] duration-300', collapsed ? 'w-[76px]' : 'w-64')}>
      {onToggle ? (
        <button
          type="button"
          onClick={onToggle}
          aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="absolute -right-3.5 top-7 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-sa-border bg-sa-surface text-sa-muted shadow-sa transition-colors hover:text-sa-accent-text"
        >
          <ChevronLeft className={cn('h-3.5 w-3.5 transition-transform duration-300', collapsed && 'rotate-180')} />
        </button>
      ) : null}

      <div className={cn('flex items-center gap-3 px-5 pb-5 pt-6', collapsed && 'justify-center px-0')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 font-heading text-lg font-bold text-white shadow-[0_8px_20px_rgba(255,107,0,0.3)]">V</div>
        {!collapsed ? (
          <div className="min-w-0">
            <p className="font-heading text-base font-bold leading-tight text-sa-text">Vaija</p>
            <p className="text-xs font-semibold text-sa-accent-text">Administração SaaS</p>
          </div>
        ) : null}
      </div>

      <nav aria-label="Menu do painel SaaS" className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {groups.map((group) => (
          <div key={group.label}>
            {!collapsed ? <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-sa-soft">{group.label}</p> : <div className="mx-3 mb-2 h-px bg-sa-border" />}
            <div className="space-y-0.5">
              {group.links.map(({ to, label, icon: Icon }) => {
                const isActive = to === '/saas' ? location.pathname === '/saas' : location.pathname === to || location.pathname.startsWith(`${to}/`)
                return (
                  <Link
                    key={to}
                    to={to}
                    title={collapsed ? label : undefined}
                    aria-current={isActive ? 'page' : undefined}
                    className={cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                      collapsed && 'mx-auto w-11 justify-center px-0',
                      isActive ? 'bg-sa-accent text-white shadow-[0_8px_18px_rgba(255,107,0,0.25)]' : 'text-sa-muted hover:bg-sa-hover hover:text-sa-text',
                    )}
                  >
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    {!collapsed ? <span className="truncate">{label}</span> : null}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className={cn('border-t border-sa-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]', collapsed && 'flex justify-center')}>
        <button
          type="button"
          title={collapsed ? 'Sair' : undefined}
          onClick={() => {
            void logout().finally(() => navigate('/login', { replace: true }))
          }}
          className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-sa-muted transition-colors hover:bg-sa-hover hover:text-sa-text', collapsed && 'w-11 justify-center px-0')}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed ? <span className="truncate">Sair{user?.name ? ` · ${user.name.split(' ')[0]}` : ''}</span> : null}
        </button>
      </div>
    </aside>
  )
}
