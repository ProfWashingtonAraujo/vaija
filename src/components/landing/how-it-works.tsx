import type { LucideIcon } from 'lucide-react'
import { BarChart3, ClipboardList, MenuSquare, Workflow } from 'lucide-react'
import { motion } from 'framer-motion'
import { PageContainer } from '@/components/layout/page-container'
import { SectionHeader } from '@/components/shared/section-header'

const steps: Array<{ number: number; icon: LucideIcon; title: string }> = [
  { number: 1, icon: MenuSquare, title: 'Cadastre seu cardápio' },
  { number: 2, icon: ClipboardList, title: 'Receba pedidos' },
  { number: 3, icon: Workflow, title: 'Controle a operação' },
  { number: 4, icon: BarChart3, title: 'Analise resultados' },
]

export function HowItWorks() {
  return (
    <section className="bg-section py-20">
      <PageContainer constrained>
        <SectionHeader title="Da venda ao relatório em poucos passos." description="Fluxo simples para equipes operarem com velocidade e para gestores acompanharem o negócio com clareza." />
        <div className="relative mt-12 grid gap-5 lg:grid-cols-4">
          <div className="absolute left-[12.5%] right-[12.5%] top-16 hidden h-px bg-orange-200 lg:block" />
          {steps.map(({ number, icon: Icon, title }, index) => (
            <motion.div key={title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: index * 0.08 }} className="relative rounded-[28px] border border-orange-100 bg-white p-5 shadow-sm">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-500 font-heading text-lg font-bold text-white">{number}</div>
              <div className="mt-5 inline-flex rounded-2xl bg-orange-50 p-3 text-orange-600"><Icon className="h-5 w-5" /></div>
              <h3 className="mt-4 font-heading text-xl font-bold text-slate-900">{title}</h3>
            </motion.div>
          ))}
        </div>
      </PageContainer>
    </section>
  )
}
