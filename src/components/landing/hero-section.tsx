import { ArrowRight, CirclePlay } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'
import { formatCurrency } from '@/lib/formatters'

const floatingHighlights = [
  { label: 'Faturamento hoje', value: formatCurrency(2840) },
  { label: 'Pedidos hoje', value: '42 pedidos' },
  { label: 'Operação', value: 'Pedido #4852 enviado para produção' },
]

const heroImage =
  'https://images.unsplash.com/photo-1559339352-11d035aa65de?auto=format&fit=crop&w=1400&q=80'

export function HeroSection() {
  return (
    <section id="inicio" className="relative overflow-hidden py-16 lg:py-24">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,178,107,0.22),_transparent_40%),radial-gradient(circle_at_right,_rgba(255,107,0,0.12),_transparent_35%)]" />
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-orange-200 to-transparent" />
      <PageContainer className="relative grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="inline-flex rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-orange-700">Plataforma premium para restaurantes modernos</span>
          <h1 className="mt-6 font-heading text-5xl font-extrabold tracking-tight text-slate-900 md:text-7xl">Controle seu delivery, PDV e restaurante em uma <span className="text-orange-500">única plataforma</span>.</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">A Vaija une pedidos, caixa, cardápio digital, relatórios e operação em tempo real para restaurantes que querem vender mais com organização e velocidade.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button className="gap-2 shadow-[0_18px_34px_rgba(255,107,0,0.22)]">Começar agora <ArrowRight className="h-4 w-4" /></Button>
            <a href="#dashboard"><Button variant="outline" className="gap-2 border-orange-200 bg-white/90"><CirclePlay className="h-4 w-4" />Ver demonstração</Button></a>
          </div>
          <p className="mt-4 text-sm text-slate-500">Sem instalação complexa • Interface rápida • Ideal para delivery, salão e balcão</p>
          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            {['Implantação visual imediata', 'Operação em tempo real', 'Demonstração pronta para venda'].map((item) => (
              <div key={item} className="rounded-[24px] border border-orange-100 bg-white/75 px-4 py-3 text-sm font-medium text-slate-700 shadow-[0_10px_24px_rgba(15,23,42,0.04)] backdrop-blur-sm">
                {item}
              </div>
            ))}
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 36 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, delay: 0.1 }} className="relative">
          <div className="absolute left-10 top-8 h-28 w-28 rounded-full bg-orange-200/50 blur-3xl" />
          <div className="absolute right-10 top-20 h-36 w-36 rounded-full bg-orange-300/35 blur-3xl" />
          <div className="absolute inset-x-12 bottom-6 h-24 rounded-full bg-orange-400/20 blur-3xl" />
          <div className="relative rounded-[34px] border border-orange-200 bg-white/92 p-4 shadow-[0_30px_80px_rgba(255,107,0,0.12)] backdrop-blur-sm">
            <div className="relative overflow-hidden rounded-[28px] border border-orange-100 bg-[#fffaf5]">
              <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(31,41,55,0.05),rgba(255,107,0,0.18))]" />
              <img src={heroImage} alt="Equipe operando restaurante com atendimento e produção integrados" className="h-[540px] w-full object-cover" />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,253,248,0.06),rgba(31,41,55,0.48))]" />

              <div className="absolute left-5 top-5 max-w-[210px] rounded-[24px] border border-orange-200/80 bg-white/90 p-3.5 shadow-[0_18px_40px_rgba(15,23,42,0.16)] backdrop-blur-sm">
                <p className="text-[11px] text-slate-500">Fluxo operacional</p>
                <div className="mt-2.5 space-y-2">
                  {['Pedido recebido', 'Em produção', 'Pronto para retirada', 'Saiu para entrega'].map((step) => (
                    <div key={step} className="rounded-2xl border border-orange-100 bg-orange-50/70 px-3 py-2 text-[11px] font-semibold text-slate-700 sm:text-xs">
                      {step}
                    </div>
                  ))}
                </div>
              </div>

              <div className="absolute inset-x-5 top-5 hidden gap-3 md:grid md:grid-cols-3 md:pl-[240px]">
                {floatingHighlights.map((item) => (
                  <motion.div
                    key={item.label}
                    animate={{ y: [0, -6, 0] }}
                    transition={{ repeat: Number.POSITIVE_INFINITY, duration: 4, ease: 'easeInOut' }}
                    className="min-w-0 rounded-2xl border border-orange-200/80 bg-white/88 p-2.5 text-slate-700 shadow-[0_18px_40px_rgba(15,23,42,0.12)] backdrop-blur-sm"
                  >
                    <p className="text-[9px] font-semibold uppercase tracking-[0.14em] text-orange-700/80">{item.label}</p>
                    <p className="mt-1 text-[11px] leading-4 font-semibold break-words text-slate-800 sm:text-xs">{item.value}</p>
                  </motion.div>
                ))}
              </div>

              <div className="absolute bottom-5 left-5 right-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
                <div className="min-w-0 rounded-[24px] border border-orange-200/80 bg-white/92 p-3.5 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-sm">
                  <p className="text-[11px] text-slate-500">Vendas hoje</p>
                  <p className="mt-1.5 break-words font-mono text-lg font-bold tracking-[-0.04em] text-slate-900 sm:text-xl">{formatCurrency(2840)}</p>
                </div>
                <div className="min-w-0 rounded-[24px] border border-orange-200/80 bg-white/92 p-3.5 shadow-[0_18px_40px_rgba(15,23,42,0.14)] backdrop-blur-sm">
                   <p className="text-[11px] text-slate-500">Ticket médio</p>
                  <p className="mt-1.5 break-words font-mono text-lg font-bold tracking-[-0.04em] text-slate-900 sm:text-xl">{formatCurrency(67.6)}</p>
                </div>
                <div className="hidden rounded-[24px] border border-orange-200/80 bg-slate-900/78 px-4 py-3.5 text-white shadow-[0_18px_40px_rgba(15,23,42,0.2)] backdrop-blur-sm md:block">
                  <p className="text-[9px] uppercase tracking-[0.18em] text-orange-200">Status ao vivo</p>
                  <p className="mt-1.5 text-xs font-semibold">42 pedidos hoje</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </PageContainer>
    </section>
  )
}
