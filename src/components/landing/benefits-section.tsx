import { CheckCircle2 } from 'lucide-react'
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

export function BenefitsSection() {
  return (
    <section className="py-20">
      <PageContainer constrained className="grid items-center gap-12 lg:grid-cols-2">
        <div>
          <SectionHeader align="left" title="Menos bagunça. Mais pedidos. Mais controle." description="A Vaija foi criada para reduzir erros, acelerar o atendimento e dar ao gestor uma visão clara da operação, seja no balcão, salão, cozinha ou delivery." />
          <div className="mt-8 grid gap-4">
            {benefits.map((benefit) => (
              <div key={benefit} className="flex items-center gap-3 rounded-2xl border border-orange-100 bg-white px-4 py-4 shadow-sm">
                <CheckCircle2 className="h-5 w-5 text-orange-600" />
                <span className="font-medium text-slate-700">{benefit}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-[34px] border border-orange-200 bg-[#fffaf5] p-6">
          <div className="grid gap-4">
            {['Pedido recebido', 'Em produção', 'Pronto para retirada', 'Saiu para entrega', 'Entregue'].map((step, index) => (
              <motion.div key={step} animate={{ y: [0, index % 2 === 0 ? -6 : 6, 0] }} transition={{ repeat: Number.POSITIVE_INFINITY, duration: 4 + index, ease: 'easeInOut' }} className="rounded-[24px] border border-orange-200 bg-white px-5 py-4 font-semibold text-slate-800 shadow-sm">
                {step}
              </motion.div>
            ))}
          </div>
        </div>
      </PageContainer>
    </section>
  )
}
