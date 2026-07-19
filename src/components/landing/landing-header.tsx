import { Menu } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'
import { MobileDrawer } from '@/components/shared/mobile-drawer'

const nav = ['Início', 'Recursos', 'Dashboard', 'Planos', 'Depoimentos', 'FAQ']

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16)
    onScroll()
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header className={`sticky top-0 z-40 border-b transition-all duration-300 ${scrolled ? 'border-orange-100 bg-white/90 shadow-[0_10px_30px_rgba(15,23,42,0.06)] glass' : 'border-transparent bg-white/70'}`}>
      <PageContainer className="flex h-20 items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 font-heading text-lg font-bold text-white shadow-[0_10px_24px_rgba(255,107,0,0.3)]">V</div>
          <div>
            <p className="font-heading text-xl font-bold text-slate-900">Vaija</p>
            <p className="text-xs text-slate-500">Gestão gastronômica em movimento.</p>
          </div>
        </Link>
        <nav className="hidden items-center gap-6 lg:flex">
          {nav.map((item) => <a key={item} href={`#${item.toLowerCase()}`} className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-orange-50 hover:text-orange-600">{item}</a>)}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/login"><Button variant="outline" className="border-orange-200 bg-white/90">Entrar</Button></Link>
          <Button className="shadow-[0_14px_30px_rgba(255,107,0,0.22)]">Começar agora</Button>
        </div>
        <div className="lg:hidden">
          <MobileDrawer trigger={<Button variant="outline" className="h-11 w-11 px-0"><Menu className="h-5 w-5" /></Button>}>
            <div className="flex h-full flex-col p-6">
              <div className="flex items-center gap-3 border-b border-orange-100 pb-6">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 font-heading font-bold text-white shadow-[0_10px_24px_rgba(255,107,0,0.3)]">V</div>
                <div>
                  <p className="font-heading text-xl font-bold text-slate-900">Vaija</p>
                  <p className="text-xs text-slate-500">Restaurantes modernos</p>
                </div>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                {nav.map((item) => <a key={item} href={`#${item.toLowerCase()}`} className="rounded-2xl border border-orange-100 bg-white px-4 py-3 font-semibold text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.04)]">{item}</a>)}
              </div>
              <div className="mt-auto grid gap-3 pt-6">
                <Link to="/login"><Button variant="outline" className="w-full border-orange-200 bg-white/90">Entrar</Button></Link>
                <Button className="w-full shadow-[0_14px_30px_rgba(255,107,0,0.22)]">Começar agora</Button>
              </div>
            </div>
          </MobileDrawer>
        </div>
      </PageContainer>
    </header>
  )
}
