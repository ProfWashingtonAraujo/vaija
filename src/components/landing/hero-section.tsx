import { ArrowRight, CirclePlay, TrendingUp, CheckCircle2, ShoppingBag } from 'lucide-react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { PageContainer } from '@/components/layout/page-container'
import { formatCurrency } from '@/lib/formatters'

const heroImage = 'https://images.unsplash.com/photo-1559925393-8be0ec4767c8?auto=format&fit=crop&w=2000&q=80'

export function HeroSection() {
  return (
    <section id="inicio" className="relative flex min-h-[90vh] items-center overflow-hidden bg-[#fffaf5] pt-20 pb-16 lg:pt-28 lg:pb-24">
      {/* Background Image on the right blending into the left */}
      <div className="absolute inset-0 w-full opacity-90">
        <img
          src={heroImage}
          alt="Fachada de restaurante com mesas na calçada"
          fetchPriority="high"
          className="h-full w-full object-cover"
        />
        {/* Gradients to blend smoothly with the left side and bottom */}
        <div className="absolute inset-0 bg-gradient-to-r from-[#fffaf5] via-[#fffaf5]/75 to-transparent lg:via-[#fffaf5]/70" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#fffaf5] via-transparent to-transparent lg:hidden" />
        {/* Soft orange/dark overlay to make glassmorphism pop */}
        <div className="absolute inset-0 bg-gradient-to-bl from-orange-900/20 to-transparent" />
      </div>

      <PageContainer constrained className="relative z-10 grid gap-12 lg:grid-cols-[1.1fr_0.9fr] items-center">
        {/* Left Side: Text Content */}
        <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, ease: "easeOut" }}>
          <span className="inline-flex items-center gap-2 rounded-full border border-orange-200 bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-orange-700 shadow-sm backdrop-blur-sm">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
            </span>
            Do pedido ao resultado
          </span>

          <h1 className="mt-8 font-heading text-5xl font-extrabold tracking-tight text-slate-900 sm:text-6xl md:text-7xl lg:leading-[1.1]">
            Seu restaurante no <span className="text-orange-500">controle.</span> <br />
            Seu atendimento em <span className="text-orange-500">movimento.</span>
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-700 font-medium">
            Centralize delivery, balcão, caixa e cardápio em uma operação simples. Menos retrabalho para a equipe, mais clareza para você vender e decidir.
          </p>

          <div className="mt-10 flex flex-col gap-4 sm:flex-row">
            <Link to="/comprar?plano=Free">
              <Button className="h-14 w-full gap-2 rounded-2xl text-base shadow-[0_8px_24px_rgba(255,107,0,0.25)] transition-all hover:translate-y-[-2px] hover:shadow-[0_12px_32px_rgba(255,107,0,0.35)] sm:w-auto">
                Começar grátis <ArrowRight className="h-5 w-5" />
              </Button>
            </Link>
            <a href="#dashboard">
              <Button variant="outline" className="h-14 w-full gap-2 rounded-2xl border-orange-200 bg-white/80 text-base backdrop-blur-sm transition-all hover:bg-white sm:w-auto">
                <CirclePlay className="h-5 w-5 text-orange-500" /> Ver demonstração
              </Button>
            </a>
          </div>

          <p className="mt-5 text-sm font-medium text-slate-500">Plano gratuito • Sem instalação complexa • Cancele quando quiser</p>

          <div className="mt-12 flex flex-wrap gap-3">
            {['Pedidos unificados', 'Tempo real', 'Dados precisos'].map((item) => (
              <div key={item} className="flex items-center gap-2 rounded-full border border-orange-100 bg-white/60 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm backdrop-blur-sm">
                <CheckCircle2 className="h-4 w-4 text-orange-500" />
                {item}
              </div>
            ))}
          </div>
        </motion.div>

        {/* Right Side: Floating Glass Widgets over the background image */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.2 }}
          className="relative h-[500px] w-full hidden lg:block"
        >
          {/* Main Operational Flow Card */}
          <motion.div
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            className="absolute left-0 top-12 w-[260px] rounded-[28px] border border-white/50 bg-white/30 p-5 shadow-[0_24px_60px_rgba(0,0,0,0.12)] backdrop-blur-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-800">Fluxo da Cozinha</p>
              <div className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2 py-1">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-bold text-emerald-700">AO VIVO</span>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { step: 'Pedido #4852', status: 'Em produção', color: 'bg-orange-500' },
                { step: 'Pedido #4853', status: 'Pronto p/ retirada', color: 'bg-emerald-500' },
                { step: 'Pedido #4854', status: 'Saiu p/ entrega', color: 'bg-sky-500' }
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3 rounded-2xl bg-white/70 p-3 shadow-sm transition-all hover:bg-white/90">
                  <div className={`h-2.5 w-2.5 rounded-full ${item.color} shadow-sm`} />
                  <div>
                    <p className="text-xs font-bold text-slate-800">{item.step}</p>
                    <p className="text-[10px] font-semibold text-slate-500">{item.status}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Revenue Card */}
          <motion.div
            animate={{ y: [5, -5, 5] }}
            transition={{ duration: 7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 1 }}
            className="absolute -right-4 top-32 rounded-[28px] border border-white/50 bg-white/30 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.12)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 shadow-lg shadow-emerald-500/30">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-800">Vendas Hoje</p>
                <p className="font-mono text-2xl font-extrabold tracking-tight text-slate-900">{formatCurrency(2840)}</p>
              </div>
            </div>
          </motion.div>

          {/* Orders Counter Card */}
          <motion.div
            animate={{ y: [-5, 5, -5] }}
            transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 2 }}
            className="absolute bottom-20 left-20 rounded-[28px] border border-white/50 bg-slate-900/40 p-6 shadow-[0_24px_60px_rgba(0,0,0,0.2)] backdrop-blur-xl"
          >
             <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 shadow-lg shadow-orange-500/30">
                <ShoppingBag className="h-6 w-6 text-white" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-orange-200">Pedidos Concluídos</p>
                <p className="font-mono text-2xl font-extrabold tracking-tight text-white">42</p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </PageContainer>
    </section>
  )
}
