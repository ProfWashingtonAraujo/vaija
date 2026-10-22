import { Bell, ChevronRight, Volume2, VolumeX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { UserAvatar } from '@/components/shared/user-avatar'
import { Button } from '@/components/ui/button'
import { checkNewOrders, clearAlerts, markAlertsRead, setAlertSound, useOrderAlerts } from '@/lib/order-alerts'
import { orderSourceIcons, orderSourceLabel, resolveOrderSource } from '@/lib/order-source'
import { formatCurrency } from '@/lib/formatters'
import { usePolling } from '@/lib/use-polling'
import { ThemeToggle } from '@/components/saas/theme-toggle'
import type { SaasTheme } from '@/lib/saas-theme'
import { OpenCashDialog } from '@/components/cash/cash-dialogs'
import { hoursOpenTooLong } from '@/components/cash/cash-report'
import { cashRegisterUpdatedEvent, fetchCashRegister, readCashRegister, type CashRegisterState } from '@/lib/cash-register'

const routeLabels: Record<string, string> = {
  '/dashboard': 'Painel Geral',
  '/orders': 'Pedidos',
  '/pos': 'PDV / Caixa',
  '/menu': 'Cardápio',
  '/reports': 'Relatórios',
  '/settings': 'Configurações',
  '/users': 'Equipe',
  '/saas': 'Plataforma',
  '/operator': 'Área do Operador',
}

function NotificationBell() {
  const { items, unread, soundOn } = useOrderAlerts()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', close)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', close)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const toggle = () => {
    if (!open) markAlertsRead()
    setOpen((current) => !current)
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-label={unread > 0 ? `Notificações: ${unread} novas` : 'Notificações'}
        aria-expanded={open}
        onClick={toggle}
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-sa-border bg-sa-surface text-sa-muted transition-colors hover:text-sa-text"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-sa-accent px-1 text-[10px] font-bold leading-none text-white ring-2 ring-sa-surface">{unread > 9 ? '9+' : unread}</span>
        ) : null}
      </button>
      {open ? (
        <div className="fixed inset-x-3 top-[4.25rem] z-50 overflow-hidden rounded-2xl border border-sa-border bg-sa-surface shadow-sa sm:absolute sm:inset-x-auto sm:right-0 sm:top-11 sm:w-96">
          <div className="flex items-center justify-between gap-2 border-b border-sa-border px-4 py-3">
            <p className="text-sm font-semibold text-sa-text">Novos pedidos</p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setAlertSound(!soundOn)} aria-pressed={soundOn} aria-label={soundOn ? 'Desligar som' : 'Ligar som'} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-sa-muted hover:bg-sa-hover hover:text-sa-text">
                {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
                {soundOn ? 'Som ligado' : 'Som desligado'}
              </button>
              {items.length > 0 ? <button type="button" onClick={clearAlerts} className="rounded-lg px-2 py-1 text-xs font-medium text-sa-muted hover:bg-sa-hover hover:text-sa-text">Limpar</button> : null}
            </div>
          </div>
          {items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-sa-muted">Nenhum pedido novo por enquanto. Quando chegar um pedido pelo link, ele aparece aqui.</p>
          ) : (
            <ul className="max-h-[60vh] divide-y divide-sa-border overflow-y-auto">
              {items.map((alert) => {
                const Icon = orderSourceIcons[resolveOrderSource(alert.source)]
                return (
                  <li key={alert.orderId}>
                    <button type="button" onClick={() => { setOpen(false); navigate('/orders', { state: { orderId: alert.orderId } }) }} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-sa-hover">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sa-accent-soft text-sa-accent-text"><Icon className="h-4 w-4" /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-sa-text">Pedido #{alert.orderId} · {alert.customer}</span>
                        <span className="block text-xs text-sa-muted">{orderSourceLabel(alert.source, alert.tableNumber)} · {formatCurrency(alert.value)} · {new Date(alert.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}

export function AppHeader({ title, theme, onThemeChange }: { title: string; description?: string; theme: SaasTheme; onThemeChange: (theme: SaasTheme) => void }) {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [cashRegister, setCashRegister] = useState(() => readCashRegister())
  const [openCashDialog, setOpenCashDialog] = useState(false)
  const forgottenHours = cashRegister.isOpen ? hoursOpenTooLong(cashRegister.openedAt) : null
  const watchOrders = Boolean(user && !user.isPlatformAdmin)
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

  // a cada tela nova o cabeçalho monta de novo: a primeira checagem também cria a base de pedidos já vistos
  useEffect(() => {
    if (watchOrders) void checkNewOrders()
  }, [watchOrders])
  usePolling(() => { if (watchOrders) return checkNewOrders() })

  // abrir pede o fundo de troco aqui mesmo; fechar exige contar o dinheiro, então leva à tela do caixa
  const toggleCashRegister = () => {
    if (cashRegister.isOpen) navigate('/cash', { state: { close: true } })
    else setOpenCashDialog(true)
  }

  return (
    <header className="relative z-40 flex h-16 shrink-0 items-center justify-between border-b border-sa-border bg-sa-bg/85 px-4 backdrop-blur-md sm:px-6">
      {/* Left: breadcrumb (o menu no celular fica na barra inferior) */}
      <div className="flex items-center gap-3">
        {/* Breadcrumb */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm">
          <span className="hidden font-medium text-sa-soft sm:inline">Vaija</span>
          <ChevronRight className="hidden h-3.5 w-3.5 text-sa-soft sm:block" />
          <span className="whitespace-nowrap font-semibold text-sa-text">{pageLabel}</span>
        </nav>
      </div>

      {/* Right: actions + user */}
      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeToggle theme={theme} onChange={onThemeChange} />
        {/* Cash register */}
        {canManageCashRegister && (
          <div className="flex items-center gap-2">
            <span className={`hidden rounded-lg border px-2.5 py-1 text-xs font-semibold sm:inline ${forgottenHours !== null ? 'border-sa-border-strong bg-sa-warn-soft text-sa-warn' : 'border-sa-border bg-sa-accent-soft text-sa-accent-text'}`}>
              {forgottenHours !== null ? `Caixa aberto há ${forgottenHours} h` : `Caixa ${cashRegister.isOpen ? 'aberto' : 'fechado'}`}
            </span>
            <Button
              type="button"
              variant={cashRegister.isOpen ? 'outline' : 'default'}
              onClick={toggleCashRegister}
              className="h-8 whitespace-nowrap rounded-lg px-3 !text-xs leading-none shadow-none"
            >
              {cashRegister.isOpen ? 'Fechar caixa' : 'Abrir caixa'}
            </Button>
          </div>
        )}

        {canManageCashRegister ? <OpenCashDialog open={openCashDialog} onOpenChange={setOpenCashDialog} onOpened={() => navigate('/cash')} /> : null}

        {watchOrders ? <NotificationBell /> : null}

        {/* User chip */}
        <div className="flex items-center gap-2 rounded-full border border-sa-border bg-sa-surface py-1 pl-1 pr-3">
          <UserAvatar name={user?.name ?? 'Usuário'} />
          <div className="hidden text-left lg:block">
            <p className="text-xs font-semibold leading-tight text-sa-text">{user?.name ?? 'Usuário'}</p>
            <p className="text-[11px] leading-tight text-sa-muted">{user?.role ?? 'Perfil'}</p>
          </div>
        </div>
      </div>
    </header>
  )
}

export function PageTitle({ title, description }: { title: string; description?: string }) {
  return (
    <div className="px-4 py-5 sm:px-6">
      <h1 className="font-heading text-2xl font-bold text-sa-text sm:text-3xl">{title}</h1>
      {description && <p className="mt-1 text-sm text-sa-muted">{description}</p>}
    </div>
  )
}
