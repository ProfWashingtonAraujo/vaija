import {
  ChartNoAxesColumn,
  Cog,
  CreditCard,
  Landmark,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MenuSquare,
  Plus,
  Rocket,
  ShoppingBag,
  Truck,
  UserCog,
  Users,
  Wallet,
  ChevronLeft,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth, useTenant } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { readSettings, settingsUpdatedEvent, syncSettingsFromServer, type AppSettings } from '@/lib/settings'
import { canAccessPath, planLabels } from '@/lib/plan-access'
import { useSidebar } from '@/components/layout/sidebar-context'

const navGroups = [
  {
    label: 'Operações',
    links: [
      { to: '/dashboard', label: 'Painel Geral', icon: LayoutDashboard },
      { to: '/orders', label: 'Pedidos', icon: ShoppingBag },
      { to: '/pos', label: 'PDV / Caixa', icon: CreditCard },
      { to: '/cash', label: 'Fluxo de caixa', icon: Landmark },
      { to: '/deliveries', label: 'Entregas', icon: Truck },
    ],
  },
  {
    label: 'Cardápio',
    links: [
      { to: '/menu', label: 'Produtos', icon: MenuSquare },
    ],
  },
  {
    label: 'Gestão',
    links: [
      { to: '/reports', label: 'Relatórios', icon: ChartNoAxesColumn },
      { to: '/users', label: 'Equipe', icon: Users },
    ],
  },
  {
    label: 'Sistema',
    links: [
      { to: '/settings', label: 'Configurações', icon: Cog },
      { to: '/subscription', label: 'Assinatura', icon: Wallet },
    ],
  },
]

const operatorLinks = [
  { to: '/operator', label: 'Área do Operador', icon: UserCog },
  { to: '/orders', label: 'Pedidos', icon: ShoppingBag },
  { to: '/pos', label: 'PDV', icon: CreditCard },
]

const adminLinks = [{ to: '/saas', label: 'Painel SaaS', icon: Rocket }]

export function AppSidebar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { collapsed, toggle } = useSidebar()
  const [settings, setSettings] = useState(() => readSettings())
  const tenant = useTenant()
  const currentPlan = tenant.plan
  const canCreatePosOrder = canAccessPath(currentPlan, '/pos')

  useEffect(() => {
    const updateSettings = (event: Event) => {
      setSettings((event as CustomEvent<AppSettings>).detail ?? readSettings())
    }
    window.addEventListener(settingsUpdatedEvent, updateSettings)
    return () => window.removeEventListener(settingsUpdatedEvent, updateSettings)
  }, [])

  useEffect(() => {
    if (user && !user.isPlatformAdmin) void syncSettingsFromServer().catch(() => undefined)
  }, [user])

  const resolvedGroups = user?.isPlatformAdmin
    ? [{ label: 'Plataforma', links: adminLinks }]
    : user?.roleKey === 'operator'
      ? [{ label: 'Operações', links: operatorLinks }]
      : navGroups
          .map((group) => ({
            ...group,
            links: group.links.filter((link) => canAccessPath(currentPlan, link.to) && (link.to !== '/subscription' || user?.roleKey === 'admin')),
          }))
          .filter((group) => group.links.length > 0)

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r border-sa-border bg-sa-surface transition-[width] duration-300 ease-in-out',
        collapsed ? 'w-[76px]' : 'w-64',
      )}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        className="absolute -right-3.5 top-7 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-sa-border bg-sa-surface text-sa-muted shadow-sa transition-colors hover:text-sa-accent-text"
      >
        <ChevronLeft className={cn('h-3.5 w-3.5 transition-transform duration-300', collapsed && 'rotate-180')} />
      </button>

      {/* Brand */}
      <div className={cn('flex items-center gap-3 px-5 pb-5 pt-6', collapsed && 'justify-center px-0')}>
        <div
          className={cn(
            'flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl',
            settings.restaurant.logo
              ? 'border border-sa-border bg-white shadow-sa'
              : 'bg-gradient-to-br from-orange-500 to-orange-600 shadow-[0_8px_20px_rgba(255,107,0,0.3)]',
          )}
        >
          {settings.restaurant.logo ? (
            <img src={settings.restaurant.logo} alt={tenant.restaurantName} className="h-full w-full object-cover" />
          ) : (
            <span className="font-heading text-lg font-bold uppercase text-white">{tenant.restaurantName.trim().charAt(0) || 'V'}</span>
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-heading text-base font-bold leading-tight text-sa-text">{tenant.restaurantName}</p>
            <p className="truncate text-xs font-semibold text-sa-accent-text">{planLabels[currentPlan] ?? ''}</p>
          </div>
        )}
      </div>

      {/* New order CTA */}
      {canCreatePosOrder && !user?.isPlatformAdmin && (
        <div className={cn('px-3 pb-4', collapsed && 'flex justify-center px-2')}>
          {collapsed ? (
            <button
              type="button"
              onClick={() => navigate('/pos')}
              aria-label="Novo Pedido"
              title="Novo Pedido"
              className="flex h-11 w-11 items-center justify-center rounded-xl bg-sa-accent text-white shadow-[0_8px_18px_rgba(255,107,0,0.25)] transition-opacity hover:opacity-90"
            >
              <Plus className="h-[18px] w-[18px]" />
            </button>
          ) : (
            <Button
              onClick={() => navigate('/pos')}
              className="w-full justify-center gap-2 rounded-xl bg-sa-accent shadow-[0_8px_18px_rgba(255,107,0,0.25)] transition-opacity hover:bg-sa-accent hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              Novo Pedido
            </Button>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav aria-label="Menu do painel" className="scrollbar-thin flex-1 space-y-5 overflow-y-auto px-3 pb-4">
        {resolvedGroups.map((group) => (
          <div key={group.label}>
            {!collapsed ? (
              <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-sa-soft">{group.label}</p>
            ) : (
              <div className="mx-3 mb-2 h-px bg-sa-border" />
            )}
            <div className="space-y-0.5">
              {group.links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors',
                      collapsed && 'mx-auto w-11 justify-center px-0',
                      isActive ? 'bg-sa-accent text-white shadow-[0_8px_18px_rgba(255,107,0,0.25)]' : 'text-sa-muted hover:bg-sa-hover hover:text-sa-text',
                    )
                  }
                >
                  <Icon className="h-[18px] w-[18px] shrink-0" />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer actions */}
      <div className={cn('space-y-0.5 border-t border-sa-border p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]', collapsed && 'flex flex-col items-center')}>
        <button
          type="button"
          title={collapsed ? 'Suporte' : undefined}
          onClick={() => navigate(user?.isPlatformAdmin ? '/saas/suporte' : '/support')}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-sa-muted transition-colors hover:bg-sa-hover hover:text-sa-text',
            collapsed && 'w-11 justify-center px-0',
          )}
        >
          <LifeBuoy className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="truncate">Suporte</span>}
        </button>
        <button
          type="button"
          title={collapsed ? 'Sair' : undefined}
          onClick={() => void logout().finally(() => navigate('/login', { replace: true }))}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-sa-muted transition-colors hover:bg-sa-bad-soft hover:text-sa-bad',
            collapsed && 'w-11 justify-center px-0',
          )}
        >
          <LogOut className="h-[18px] w-[18px] shrink-0" />
          {!collapsed && <span className="truncate">Sair{user?.name ? ` · ${user.name.split(' ')[0]}` : ''}</span>}
        </button>
      </div>
    </aside>
  )
}
