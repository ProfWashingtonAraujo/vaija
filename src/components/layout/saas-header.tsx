import { Menu, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { MobileDrawer } from '@/components/shared/mobile-drawer'
import { SaasSidebar } from '@/components/layout/saas-sidebar'
import { UserAvatar } from '@/components/shared/user-avatar'

export function SaasHeader({ title, description }: { title: string; description: string }) {
  const { user } = useAuth()

  return (
    <header className="relative mb-6 overflow-hidden rounded-[30px] border border-orange-100 bg-slate-950 p-4 text-white shadow-[0_18px_42px_rgba(15,23,42,0.14)] sm:p-5">
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_top_right,rgba(255,107,0,0.35),transparent_30%),linear-gradient(135deg,#0f172a,#111827_58%,#431407)]" />
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-start gap-3">
          <div className="lg:hidden">
            <MobileDrawer trigger={<Button variant="outline" className="h-11 w-11 border-white/20 bg-white/10 px-0 text-white hover:bg-white/20 hover:text-white"><Menu className="h-5 w-5" /></Button>}>
              <div className="h-full p-4"><SaasSidebar /></div>
            </MobileDrawer>
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold text-orange-50">
              <ShieldCheck className="h-3.5 w-3.5" />Administração principal
            </div>
            <h1 className="mt-3 font-heading text-2xl font-bold sm:text-3xl">{title}</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-orange-50">{description}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3 rounded-[24px] border border-white/15 bg-white/10 px-3 py-2 backdrop-blur">
          <UserAvatar name={user?.name ?? 'Vaija'} />
          <div>
            <p className="text-sm font-semibold leading-tight">{user?.name ?? 'Administrador'}</p>
            <p className="text-xs leading-tight text-orange-50">{user?.email ?? 'admin@vaija.com.br'}</p>
          </div>
        </div>
      </div>
    </header>
  )
}
