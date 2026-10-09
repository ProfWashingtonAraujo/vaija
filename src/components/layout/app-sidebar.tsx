import {
  ChartNoAxesColumn,
  Cog,
  CreditCard,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  MenuSquare,
  Plus,
  Rocket,
  ShoppingBag,
  UserCog,
  Users,
  ChevronLeft,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { restaurant } from '@/data/mock-restaurant'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { readSettings, settingsUpdatedEvent, syncSettingsFromServer, type AppSettings } from '@/lib/settings'
import { canAccessPath, planLabels } from '@/lib/plan-access'
import { getTenantForUser, tenantsUpdatedEvent, type Tenant } from '@/lib/tenants-api'
import { useSidebar } from '@/components/layout/sidebar-context'

const navGroups = [
  {
    label: 'Operações',
    links: [
      { to: '/dashboard', label: 'Painel Geral', icon: LayoutDashboard },
      { to: '/orders', label: 'Pedidos', icon: ShoppingBag },
      { to: '/pos', label: 'PDV / Caixa', icon: CreditCard },
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
    links: [{ to: '/settings', label: 'Configurações', icon: Cog }],
  },
]

const operatorLinks = [
  { to: '/operator', label: 'Área do Operador', icon: UserCog },
  { to: '/orders', label: 'Pedidos', icon: ShoppingBag },
  { to: '/pos', label: 'PDV', icon: CreditCard },
]

const adminLinks = [{ to: '/activation', label: 'Ativação', icon: Rocket }]

export function AppSidebar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const { collapsed, toggle } = useSidebar()
  const [settings, setSettings] = useState(() => readSettings())
  const [tenant, setTenant] = useState(() => getTenantForUser(user))
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

  useEffect(() => {
    const updateTenant = (event: Event) => {
      const tenants = (event as CustomEvent<Tenant[]>).detail
      setTenant(tenants?.find((item) => item.id === user?.restaurantId) ?? getTenantForUser(user))
    }
    window.addEventListener(tenantsUpdatedEvent, updateTenant)
    return () => window.removeEventListener(tenantsUpdatedEvent, updateTenant)
  }, [user])

  const resolvedGroups = user?.isPlatformAdmin
    ? [{ label: 'Plataforma', links: adminLinks }]
    : user?.roleKey === 'operator'
      ? [{ label: 'Operações', links: operatorLinks }]
      : navGroups
          .map((group) => ({
            ...group,
            links: group.links.filter((link) => canAccessPath(currentPlan, link.to)),
          }))
          .filter((group) => group.links.length > 0)

  return (
    <aside
      className={cn(
        'relative flex h-full flex-col border-r border-orange-100/60 bg-gradient-to-b from-[#fffdf8] to-white transition-all duration-300 ease-in-out',
        collapsed ? 'w-[72px]' : 'w-72',
      )}
    >
      {/* Toggle button */}
      <button
        type="button"
        onClick={toggle}
        aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'}
        className={cn(
          'absolute -right-3.5 top-8 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-orange-200 bg-white shadow-[0_4px_12px_rgba(255,107,0,0.15)] transition-all duration-300 hover:border-orange-300 hover:bg-orange-50',
        )}
      >
        <ChevronLeft
          className={cn('h-3.5 w-3.5 text-orange-500 transition-transform duration-300', collapsed && 'rotate-180')}
        />
      </button>

      {/* Brand */}
      <div className={cn('flex items-center gap-3 px-4 pt-5 pb-4', collapsed && 'justify-center px-0')}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-500 to-orange-600 shadow-[0_8px_20px_rgba(255,107,0,0.3)]">
          {settings.restaurant.logo ? (
            <img src={settings.restaurant.logo} alt={tenant.restaurantName} className="h-full w-full object-contain p-1" />
          ) : (
            <span className="font-heading text-base font-bold text-white">V</span>
          )}
        </div>
        {!collapsed && (
          <div className="min-w-0 overflow-hidden">
            <p className="truncate font-heading text-sm font-bold text-slate-900">{tenant.restaurantName}</p>
            <p className="truncate text-xs font-medium text-orange-600">{planLabels[currentPlan] ?? restaurant.plan}</p>
          </div>
        )}
      </div>

      <div className={cn('mx-3 mb-3 h-px bg-gradient-to-r from-transparent via-orange-100 to-transparent', collapsed && 'mx-2')} />

      {/* New order CTA */}
      {canCreatePosOrder && !user?.isPlatformAdmin && (
        <div className={cn('px-3 pb-3', collapsed && 'flex justify-center px-2')}>
          {collapsed ? (
            <button
              type="button"
              onClick={() => navigate('/pos')}
              aria-label="Novo Pedido"
              className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-[0_8px_20px_rgba(255,107,0,0.3)] transition-all hover:shadow-[0_12px_28px_rgba(255,107,0,0.4)]"
            >
              <Plus className="h-4 w-4 text-white" />
            </button>
          ) : (
            <Button
              onClick={() => navigate('/pos')}
              className="w-full justify-center gap-2 rounded-2xl shadow-[0_10px_24px_rgba(255,107,0,0.25)] transition-all hover:shadow-[0_14px_32px_rgba(255,107,0,0.35)]"
            >
              <Plus className="h-4 w-4" />
              Novo Pedido
            </Button>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2 scrollbar-thin">
        {resolvedGroups.map((group) => (
          <div key={group.label} className="mb-1">
            {!collapsed && (
              <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
                {group.label}
              </p>
            )}
            {collapsed && <div className="my-1.5 h-px mx-2 bg-orange-100/70" />}
            <div className="space-y-0.5">
              {group.links.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  title={collapsed ? label : undefined}
                  className={({ isActive }) =>
                    cn(
                      'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-150',
                      collapsed && 'justify-center px-0 py-2.5 mx-auto w-11',
                      isActive
                        ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-[0_6px_16px_rgba(255,107,0,0.25)]'
                        : 'text-slate-500 hover:bg-orange-50 hover:text-slate-900',
                    )
                  }
                >
                  <Icon className={cn('h-4 w-4 shrink-0', !collapsed && 'group-[.active]:text-white')} />
                  {!collapsed && <span className="truncate">{label}</span>}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>

      {/* Footer actions */}
      <div className={cn('border-t border-orange-100/60 p-2', collapsed && 'flex flex-col items-center gap-1')}>
        <button
          type="button"
          title={collapsed ? 'Suporte' : undefined}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-all hover:bg-orange-50 hover:text-slate-900',
            collapsed && 'w-11 justify-center px-0',
          )}
        >
          <LifeBuoy className="h-4 w-4 shrink-0" />
          {!collapsed && 'Suporte'}
        </button>
        <button
          type="button"
          title={collapsed ? 'Sair' : undefined}
          onClick={() => void logout().finally(() => navigate('/login', { replace: true }))}
          className={cn(
            'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-500 transition-all hover:bg-red-50 hover:text-red-600',
            collapsed && 'w-11 justify-center px-0',
          )}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && 'Sair'}
        </button>
      </div>
    </aside>
  )
}
