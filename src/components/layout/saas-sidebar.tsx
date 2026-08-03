import { Building2, ClipboardList, CreditCard, FileClock, Headphones, KeyRound, LifeBuoy, LogOut, Rocket, Settings, ShieldCheck } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const links = [
  { to: '/saas', label: 'Visão Geral', icon: Rocket },
  { to: '/saas/clientes', label: 'Clientes', icon: Building2 },
  { to: '/saas/planos', label: 'Planos', icon: ClipboardList },
  { to: '/saas/financeiro', label: 'Financeiro', icon: CreditCard },
  { to: '/saas/acessos', label: 'Acessos', icon: KeyRound },
  { to: '/saas/ativacoes', label: 'Ativações', icon: ShieldCheck },
  { to: '/saas/leads', label: 'Leads', icon: FileClock },
  { to: '/saas/suporte', label: 'Suporte', icon: Headphones },
  { to: '/saas/auditoria', label: 'Auditoria', icon: FileClock },
  { to: '/saas/configuracoes', label: 'Configurações', icon: Settings },
]

export function SaasSidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout } = useAuth()

  return (
    <aside className="flex h-full w-full flex-col rounded-[32px] border border-orange-100 bg-gradient-to-b from-white via-[#fffaf5] to-orange-50/60 p-4 shadow-[0_18px_46px_rgba(255,107,0,0.08)] lg:w-72">
      <div className="rounded-[28px] border border-orange-200 bg-white/95 p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 font-heading text-lg font-bold text-white shadow-[0_10px_24px_rgba(255,107,0,0.28)]">V</div>
          <div>
            <p className="font-heading text-lg font-bold text-slate-900">Vaija</p>
            <p className="text-sm font-semibold text-orange-700">Administração SaaS</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-[24px] border border-orange-100 bg-white/75 p-4">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Ambiente</p>
        <p className="mt-1 text-sm font-semibold text-slate-900">Gestão comercial Vaija</p>
      </div>

      <nav className="mt-5 space-y-2 rounded-[28px] border border-white/70 bg-white/60 p-2 backdrop-blur-sm">
        {links.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/saas' ? location.pathname === '/saas' : location.pathname === to || location.pathname.startsWith(`${to}/`)

          return (
          <Link
            key={to}
            to={to}
            className={cn(
              'flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold transition-all duration-200',
              isActive
                ? 'border-orange-200 bg-white text-orange-800 shadow-[0_10px_24px_rgba(255,107,0,0.1)]'
                : 'border-transparent text-slate-600 hover:border-orange-100 hover:bg-white hover:text-slate-900',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
          )
        })}
      </nav>

      <div className="mt-auto space-y-2 pt-6">
        <button className="flex w-full items-center gap-3 rounded-2xl border border-transparent px-4 py-3 text-sm font-semibold text-slate-600 transition-all duration-200 hover:border-orange-100 hover:bg-white hover:text-slate-900">
          <LifeBuoy className="h-4 w-4" />
          Suporte
        </button>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            void logout().finally(() => navigate('/login', { replace: true }))
          }}
          className="w-full justify-start gap-3 px-4"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </Button>
      </div>
    </aside>
  )
}
