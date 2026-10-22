import { CreditCard, LayoutDashboard, Menu, ShoppingBag, Truck, UserCog } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { useAuth, useTenant } from '@/contexts/auth-context'
import { MobileDrawer } from '@/components/shared/mobile-drawer'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarProvider } from '@/components/layout/sidebar-context'
import { canAccessPath } from '@/lib/plan-access'
import { cn } from '@/lib/utils'

const managerTabs = [
  { to: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { to: '/orders', label: 'Pedidos', icon: ShoppingBag },
  { to: '/deliveries', label: 'Entregas', icon: Truck },
  { to: '/pos', label: 'Caixa', icon: CreditCard },
]

const operatorTabs = [
  { to: '/operator', label: 'Operador', icon: UserCog },
  { to: '/orders', label: 'Pedidos', icon: ShoppingBag },
  { to: '/pos', label: 'PDV', icon: CreditCard },
]

/** Navegação inferior do painel no celular; o botão Menu abre o menu completo. */
export function MobileTabBar() {
  const { user } = useAuth()
  const plan = useTenant().plan
  const tabs = user?.roleKey === 'operator' ? operatorTabs : managerTabs.filter((tab) => canAccessPath(plan, tab.to))

  return (
    <nav aria-label="Navegação" className="fixed inset-x-0 bottom-0 z-40 border-t border-orange-100 bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div className="flex">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => cn('flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', isActive ? 'text-orange-600' : 'text-slate-500')}>
            <Icon className="h-5 w-5" />{label}
          </NavLink>
        ))}
        <MobileDrawer
          trigger={<button type="button" className="flex flex-1 flex-col items-center gap-1 py-2.5 !text-[11px] font-semibold leading-normal text-slate-500"><Menu className="h-5 w-5" />Menu</button>}
        >
          <SidebarProvider><div className="h-full"><AppSidebar /></div></SidebarProvider>
        </MobileDrawer>
      </div>
    </nav>
  )
}
