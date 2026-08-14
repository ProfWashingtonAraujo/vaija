import { Bike, CheckCheck, CheckCircle2, ChefHat, Clock, PackageCheck } from 'lucide-react'
import { motion } from 'framer-motion'
import { PageContainer } from '@/components/layout/page-container'
import { SectionHeader } from '@/components/shared/section-header'

const benefits = [
  'Pedidos centralizados em tempo real',
  'PDV rápido para atendimento de balcão',
  'Cardápio com controle de disponibilidade',
  'Relatórios para tomada de decisão',
  'Interface simples para equipe operar',
  'Melhor experiência para o cliente',
]

const orderSteps = [
  { label: 'Pedido recebido', icon: Clock, color: 'text-indigo-500', bg: 'bg-indigo-50', bar: 'bg-indigo-400' },
  { label: 'Em produção', icon: ChefHat, color: 'text-orange-500', bg: 'bg-orange-50', bar: 'bg-orange-400' },
  { label: 'Pronto para retirada', icon: PackageCheck, color: 'text-emerald-500', bg: 'bg-emerald-50', bar: 'bg-emerald-400' },
  { label: 'Saiu para entrega', icon: Bike, color: 'text-sky-500', bg: 'bg-sky-50', bar: 'bg-sky-400' },
  { label: 'Entregue', icon: CheckCheck, color: 'text-slate-500', bg: 'bg-slate-100', bar: 'bg-slate-400' },
]

export function BenefitsSection() {
  return (
    <section className="py-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(255,178,107,0.1),_transparent_40%)]" />

      <PageContainer constrained className="relative grid items-center gap-16 lg:grid-cols-2">
        <div>
          <SectionHeader align="left" title="Menos bagunça. Mais pedidos. Mais controle." description="A Vaija foi criada para reduzir erros, acelerar o atendimento e dar ao gestor uma visão clara da operação, seja no balcão, salão, cozinha ou delivery." />

          <div className="mt-10 grid gap-4">
            {benefits.map((benefit, i) => (
              <motion.div
                key={benefit}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
                whileHover={{ scale: 1.02, x: 8 }}
                className="group flex items-center gap-4 rounded-2xl border border-orange-100/60 bg-white/80 px-5 py-4 shadow-[0_4px_20px_rgba(15,23,42,0.03)] backdrop-blur-sm transition-all hover:border-orange-300 hover:bg-gradient-to-r hover:from-orange-50/50 hover:to-white hover:shadow-[0_8px_30px_rgba(255,107,0,0.08)]"
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orange-100/80 transition-colors group-hover:bg-orange-500">
                  <CheckCircle2 className="h-4 w-4 text-orange-600 transition-colors group-hover:text-white" />
                </div>
                <span className="font-semibold text-slate-700 transition-colors group-hover:text-slate-900">{benefit}</span>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Right side: Dynamic Order Pipeline */}
        <div className="relative">
          <div className="relative overflow-hidden rounded-[40px] border border-orange-200/60 bg-gradient-to-br from-[#fffdf8] to-[#fffaf5] p-8 shadow-[0_20px_60px_rgba(255,107,0,0.08)]">
            {/* Glowing orbs */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-orange-400/10 blur-[60px]" />
            <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-orange-300/10 blur-[60px]" />

            <div className="relative z-10 flex flex-col gap-4">
              {orderSteps.map((step, index) => {
                const Icon = step.icon
                return (
                  <motion.div
                    key={step.label}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-50px" }}
                    transition={{ duration: 0.5, delay: index * 0.15 }}
                    className="group flex items-center gap-5 rounded-3xl border border-white/60 bg-white/70 p-4 shadow-[0_8px_30px_rgba(15,23,42,0.04)] backdrop-blur-md transition-all duration-300 hover:border-orange-200 hover:shadow-[0_16px_40px_rgba(255,107,0,0.12)]"
                  >
                    <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${step.bg} ${step.color} shadow-inner transition-transform duration-500 group-hover:scale-110 group-hover:rotate-3`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="flex-1">
                      <p className="font-heading text-lg font-bold text-slate-800">{step.label}</p>
                      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: "100%" }}
                          viewport={{ once: true }}
                          transition={{ duration: 1.2, delay: 0.4 + index * 0.15, ease: "easeOut" }}
                          className={`h-full ${step.bar} rounded-full`}
                        />
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>
          </div>

          {/* Floating decorative elements */}
          <motion.div
            animate={{ y: [-10, 10, -10], rotate: [0, 5, 0] }}
            transition={{ duration: 6, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
            className="absolute -left-6 top-20 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-100 bg-white shadow-xl"
          >
            <span className="text-2xl">🍕</span>
          </motion.div>
          <motion.div
            animate={{ y: [10, -10, 10], rotate: [0, -5, 0] }}
            transition={{ duration: 5, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut", delay: 1 }}
            className="absolute -right-6 bottom-32 flex h-16 w-16 items-center justify-center rounded-2xl border border-orange-100 bg-white shadow-xl"
          >
            <span className="text-2xl">🍔</span>
          </motion.div>
        </div>
      </PageContainer>
    </section>
  )
}
