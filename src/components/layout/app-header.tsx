import { Bell, Menu, ChevronRight } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { MobileDrawer } from '@/components/shared/mobile-drawer'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { SidebarProvider } from '@/components/layout/sidebar-context'
import { cashRegisterUpdatedEvent, fetchCashRegister, readCashRegister, setCashRegisterOpen, type CashRegisterState } from '@/lib/cash-register'

const routeLabels: Record<string, string> = {
  '/dashboard': 'Painel Geral',
  '/orders': 'Pedidos',
  '/pos': 'PDV / Caixa',
  '/menu': 'Cardápio',
  '/inventory': 'Estoque',
  '/reports': 'Relatórios',
  '/settings': 'Configurações',
  '/users': 'Equipe',
  '/saas': 'Plataforma',
  '/activation': 'Plataforma',
  '/operator': 'Área do Operador',
}

export function AppHeader({ title }: { title: string; description?: string }) {
  const { user } = useAuth()
  const location = useLocation()
  const [cashRegister, setCashRegister] = useState(() => readCashRegister())
  const canManageCashRegister = user?.roleKey === 'admin' || user?.roleKey === 'manager'
  const pageLabel = routeLabels[location.pathname] ?? title

  useEffect(() => {
    const updateCashRegister = (event: Event) => {
      setCashRegister((event as CustomEvent<CashRegisterState>).detail ?? readCashRegister())
    }
    window.addEventListener(cashRegisterUpdatedEvent, updateCashRegister)
    void fetchCashRegister().then(setCashRegister).catch(() => undefined)
    return () => window.removeEventListener(cashRegisterUpdatedEvent, updateCashRegister)
  }, [])

  const toggleCashRegister = async () => {
    if (!user) return
    const wantOpen = !cashRegister.isOpen
    try {
      setCashRegister(await setCashRegisterOpen(wantOpen, user.name))
      toast.success(wantOpen ? 'Caixa aberto com sucesso.' : 'Caixa fechado com sucesso.')
    } catch {
      toast.error('Não foi possível alterar o caixa. Tente novamente.')
    }
  }

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-orange-100/60 bg-white/80 px-4 backdrop-blur-sm sm:px-6">
      {/* Left: mobile menu + breadcrumb */}
      <div className="flex items-center gap-3">
        {/* Mobile menu trigger */}
        <div className="lg:hidden">
          <MobileDrawer
            trigger={
              <button
                type="button"
                aria-label="Abrir menu"
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-orange-200 bg-white text-slate-600 shadow-sm transition hover:border-orange-300 hover:text-orange-600"
              >
                <Menu className="h-4 w-4" />
              </button>
            }
          >
            <SidebarProvider>
              <div className="h-full">
                <AppSidebar />
              </div>
            </SidebarProvider>
          </MobileDrawer>
        </div>

        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
          <span className="font-medium text-slate-400">Vaija</span>
          <ChevronRight className="h-3.5 w-3.5 text-slate-300" />
          <span className="font-semibold text-slate-800">{pageLabel}</span>
        </nav>
      </div>

      {/* Right: actions + user */}
      <div className="flex items-center gap-2">
        {/* Cash register */}
        {canManageCashRegister && (
          <div className="hidden items-center gap-2 sm:flex">
            <span className="rounded-lg border border-orange-100 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
              Caixa {cashRegister.isOpen ? 'aberto' : 'fechado'}
            </span>
            <Button
              type="button"
              variant={cashRegister.isOpen ? 'outline' : 'default'}
              onClick={toggleCashRegister}
              className="h-8 rounded-lg px-3 text-xs shadow-none"
            >
              {cashRegister.isOpen ? 'Fechar' : 'Abrir caixa'}
            </Button>
          </div>
        )}

        {/* Notifications */}
        <button
          type="button"
          aria-label="Notificações"
          className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-orange-100 bg-white text-slate-500 transition hover:border-orange-300 hover:text-orange-600"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-orange-500 ring-2 ring-white" />
        </button>

        {/* User chip */}
        <div className="flex items-center gap-2 rounded-xl border border-orange-100 bg-[#fffaf5] py-1 pl-1 pr-3 shadow-sm">
          <UserAvatar name={user?.name ?? 'Usuário'} />
          <div className="hidden text-left lg:block">
            <p className="text-xs font-semibold leading-tight text-slate-900">{user?.name ?? 'Usuário'}</p>
            <p className="text-[11px] leading-tight text-slate-400">{user?.role ?? 'Perfil'}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-4 py-5 sm:px-6">
      <h1 className="font-heading text-2xl font-bold text-slate-900 sm:text-3xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
    </div>
  )
}
