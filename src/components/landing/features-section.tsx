import type { LucideIcon } from 'lucide-react'
import { BarChart3, Bike, CreditCard, LayoutPanelTop, MenuSquare, ShieldCheck, ShoppingBag, Users } from 'lucide-react'
import { PageContainer } from '@/components/layout/page-container'
import { SectionHeader } from '@/components/shared/section-header'

const features: Array<{ icon: LucideIcon; title: string; text: string }> = [
  { icon: CreditCard, title: 'PDV ultrarrápido', text: 'Venda com poucos toques e atendimento mais fluido no balcão.' },
  { icon: ShoppingBag, title: 'Gestão de pedidos', text: 'Centralize pedidos do salão, retirada e delivery em tempo real.' },
  { icon: MenuSquare, title: 'Cardápio digital', text: 'Controle disponibilidade, categorias e destaques visuais.' },
  { icon: BarChart3, title: 'Relatórios inteligentes', text: 'Acompanhe faturamento, mix de vendas e horários de pico.' },
  { icon: LayoutPanelTop, title: 'Controle de caixa', text: 'Visualize operação, valores e rotinas de fechamento.' },
  { icon: Bike, title: 'Operação de delivery', text: 'Acompanhe a esteira completa do pedido até a entrega.' },
  { icon: Users, title: 'Gestão de equipe', text: 'Experiência simples para operadores, caixas e gestores.' },
  { icon: ShieldCheck, title: 'Experiência intuitiva', text: 'Interface clara e responsiva para a equipe aprender sem complicação.' },
]

export function FeaturesSection() {
  return (
    <section id="recursos" className="bg-section py-20">
      <PageContainer constrained>
        <SectionHeader title="Tudo que seu restaurante precisa para vender com mais controle." description="Da entrada do pedido até o relatório final, a Vaija organiza sua operação em uma experiência rápida, elegante e intuitiva." />
        <div className="mt-12 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {features.map(({ icon: Icon, title, text }) => (
            <div key={title} className="rounded-[28px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_34px_rgba(15,23,42,0.06)] transition hover:-translate-y-1 hover:border-orange-300 hover:shadow-[0_16px_36px_rgba(255,107,0,0.12)]">
              <div className="inline-flex rounded-2xl border border-orange-100 bg-white p-3 text-orange-600 shadow-[0_10px_24px_rgba(255,107,0,0.08)]"><Icon className="h-5 w-5" /></div>
              <h3 className="mt-5 font-heading text-xl font-bold text-slate-900">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </PageContainer>
    </section>
  )
}
