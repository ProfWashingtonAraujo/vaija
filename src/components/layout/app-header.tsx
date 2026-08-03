import { Bell, Menu } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { useAuth } from '@/contexts/auth-context'
import { UserAvatar } from '@/components/shared/user-avatar'
import { SearchInput } from '@/components/shared/search-input'
import { Button } from '@/components/ui/button'
import { MobileDrawer } from '@/components/shared/mobile-drawer'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { cashRegisterUpdatedEvent, closeCashRegister, openCashRegister, readCashRegister, type CashRegisterState } from '@/lib/cash-register'

export function AppHeader({ title, description }: { title: string; description: string }) {
  const { user } = useAuth()
  const [cashRegister, setCashRegister] = useState(() => readCashRegister())
  const canManageCashRegister = user?.roleKey === 'admin' || user?.roleKey === 'manager'

  useEffect(() => {
    const updateCashRegister = (event: Event) => {
      setCashRegister((event as CustomEvent<CashRegisterState>).detail ?? readCashRegister())
    }

    window.addEventListener(cashRegisterUpdatedEvent, updateCashRegister)
    return () => window.removeEventListener(cashRegisterUpdatedEvent, updateCashRegister)
  }, [])

  const toggleCashRegister = () => {
    if (!user) {
      return
    }

    if (cashRegister.isOpen) {
      setCashRegister(closeCashRegister(user.name))
      toast.success('Caixa fechado com sucesso.')
      return
    }

    setCashRegister(openCashRegister(user.name))
    toast.success('Caixa aberto com sucesso.')
  }

  return (
    <header className="mb-6 flex flex-col gap-4 rounded-[30px] border border-orange-100 bg-white p-4 shadow-[0_14px_36px_rgba(15,23,42,0.06)] sm:p-5 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex items-start gap-3 lg:hidden">
        <MobileDrawer trigger={<Button variant="outline" className="h-11 w-11 px-0"><Menu className="h-5 w-5" /></Button>}>
          <div className="h-full p-4"><AppSidebar /></div>
        </MobileDrawer>
        <div className="min-w-0">
          <h1 className="font-heading text-xl font-bold text-slate-900 sm:text-2xl">{title}</h1>
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-slate-500">{description}</p>
        </div>
      </div>

      <div className="hidden xl:block">
        <h1 className="font-heading text-3xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>

      <div className="flex flex-1 flex-wrap items-center gap-2 md:gap-2.5 xl:flex-nowrap xl:justify-end">
        <div className="hidden min-w-0 lg:block lg:flex-1 lg:basis-72 lg:max-w-xs xl:max-w-sm">
          <SearchInput placeholder="Busca global" />
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-[26px] border border-orange-100 bg-gradient-to-r from-[#fffaf5] to-white p-1 shadow-[0_8px_24px_rgba(255,107,0,0.08)] sm:p-1.5">
          {canManageCashRegister ? (
            <>
              <span className="hidden rounded-[18px] border border-orange-100 bg-white/90 px-3 py-2 text-[13px] font-semibold text-slate-600 lg:inline-flex">
                Caixa {cashRegister.isOpen ? 'aberto' : 'fechado'}
              </span>
              <Button type="button" variant={cashRegister.isOpen ? 'outline' : 'default'} onClick={toggleCashRegister} className="h-10 rounded-[18px] px-3 text-[13px] shadow-none xl:px-4">
                {cashRegister.isOpen ? 'Fechar caixa' : 'Abrir caixa'}
              </Button>
            </>
          ) : null}
          <Button variant="outline" className="hidden h-10 rounded-[18px] border-orange-200 bg-white/90 px-3 text-[13px] shadow-none lg:inline-flex xl:px-4">Últimos 7 dias</Button>
          <Button variant="outline" className="hidden h-10 rounded-[18px] border-orange-200 bg-white/90 px-3 text-[13px] shadow-none lg:inline-flex xl:px-4">Exportar</Button>
          <button className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[18px] border border-orange-200 bg-orange-50 text-orange-600 transition-colors hover:border-orange-300 hover:bg-orange-100">
            <Bell className="h-4 w-4" />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2 rounded-[24px] border border-orange-100 bg-[#fffaf5] px-2 py-1.5 shadow-[0_8px_24px_rgba(255,107,0,0.06)] sm:px-2.5 sm:py-2 xl:px-3">
          <div className="scale-90 xl:scale-100">
            <UserAvatar name={user?.name ?? 'Usuário'} />
          </div>
          <div className="hidden min-w-0 text-left xl:block">
            <p className="text-sm font-semibold leading-tight text-slate-900">{user?.role ?? 'Perfil'}</p>
            <p className="text-xs leading-tight text-slate-500">{user?.name ?? 'Usuário'}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
