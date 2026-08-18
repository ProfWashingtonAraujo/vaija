import { Boxes, ChartNoAxesColumn, Cog, CreditCard, LayoutDashboard, LifeBuoy, LogOut, MenuSquare, Plus, Rocket, ShoppingBag, UserCog } from 'lucide-react'
import { useEffect, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { restaurant } from '@/data/mock-restaurant'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { readSettings, settingsUpdatedEvent, type AppSettings } from '@/lib/settings'
import { canAccessPath, planLabels } from '@/lib/plan-access'
import { getTenantForUser, tenantsUpdatedEvent, type Tenant } from '@/lib/tenants-api'

const links = [
  { to: '/dashboard', label: 'Painel Geral', icon: LayoutDashboard },
  { to: '/orders', label: 'Pedidos', icon: ShoppingBag },
  { to: '/pos', label: 'PDV', icon: CreditCard },
  { to: '/menu', label: 'Cardápio', icon: MenuSquare },
  { to: '/inventory', label: 'Estoque', icon: Boxes },
  { to: '/reports', label: 'Relatórios', icon: ChartNoAxesColumn },
  { to: '/settings', label: 'Configurações', icon: Cog },
  { to: '/activation', label: 'Ativação', icon: Rocket },
]

const operatorLinks = [
  { to: '/operator', label: 'Área do Operador', icon: UserCog },
  { to: '/orders', label: 'Pedidos', icon: ShoppingBag },
  { to: '/pos', label: 'PDV', icon: CreditCard },
]

export function AppSidebar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [settings, setSettings] = useState(() => readSettings())
  const [tenant, setTenant] = useState(() => getTenantForUser(user))
  const currentPlan = tenant.plan
  const visibleLinks = user?.isPlatformAdmin ? links.filter((link) => link.to === '/activation') : (user?.roleKey === 'operator' ? operatorLinks : links).filter((link) => link.to !== '/activation' && canAccessPath(currentPlan, link.to))
  const canCreatePosOrder = canAccessPath(currentPlan, '/pos')

  useEffect(() => {
    const updateSettings = (event: Event) => {
      setSettings((event as CustomEvent<AppSettings>).detail ?? readSettings())
    }

    window.addEventListener(settingsUpdatedEvent, updateSettings)
    return () => window.removeEventListener(settingsUpdatedEvent, updateSettings)
  }, [])

  useEffect(() => {
    const updateTenant = (event: Event) => {
      const tenants = (event as CustomEvent<Tenant[]>).detail
      setTenant(tenants?.find((item) => item.id === user?.restaurantId) ?? getTenantForUser(user))
    }

    window.addEventListener(tenantsUpdatedEvent, updateTenant)
    return () => window.removeEventListener(tenantsUpdatedEvent, updateTenant)
  }, [user])

  return (
    <aside className="flex h-full w-full flex-col rounded-[32px] border border-orange-100 bg-gradient-to-b from-[#fffaf5] via-[#fff8f1] to-white p-4 shadow-[0_18px_46px_rgba(255,107,0,0.08)] lg:w-72">
      <div className="rounded-[28px] border border-orange-200 bg-white/95 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-orange-100 bg-white font-heading text-lg font-bold text-orange-600 shadow-[0_10px_24px_rgba(255,107,0,0.18)]">
            {settings.restaurant.logo ? <img src={settings.restaurant.logo} alt={tenant.restaurantName} className="h-full w-full object-contain p-1" /> : 'V'}
          </div>
          <div>
            <p className="font-heading text-lg font-bold text-slate-900">{tenant.restaurantName}</p>
            <p className="text-sm text-orange-700">{planLabels[currentPlan] ?? restaurant.plan}</p>
          </div>
        </div>
      </div>

      {canCreatePosOrder && !user?.isPlatformAdmin ? (
        <Button onClick={() => navigate('/pos')} className="mt-4 w-full justify-center gap-2 rounded-[22px] shadow-[0_14px_30px_rgba(255,107,0,0.22)]">
          <Plus className="h-4 w-4" />
          Novo Pedido
        </Button>
      ) : null}

      <nav className="mt-5 space-y-2 rounded-[28px] border border-white/70 bg-white/60 p-2 backdrop-blur-sm">
        {visibleLinks.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all duration-200',
                isActive
                  ? 'border-orange-200 bg-white text-orange-800 shadow-[0_10px_24px_rgba(255,107,0,0.1)]'
                  : 'border-transparent text-slate-600 hover:border-orange-100 hover:bg-white hover:text-slate-900',
              )
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="mt-auto space-y-2 pt-6">
        <button className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-600 transition-all duration-200 hover:border-orange-100 hover:bg-white hover:text-slate-900">
          <LifeBuoy className="h-4 w-4" />
          Suporte
        </button>
        <button
          onClick={() => {
            void logout().finally(() => {
              navigate('/login', { replace: true })
            })
          }}
          className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-600 transition-all duration-200 hover:border-orange-100 hover:bg-white hover:text-slate-900"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </div>
    </aside>
  )
}
