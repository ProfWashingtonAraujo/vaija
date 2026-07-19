import { Check } from 'lucide-react'
import { toast } from 'sonner'
import { pricingPlans } from '@/data/pricing-plans'
import { PageContainer } from '@/components/layout/page-container'
import { SectionHeader } from '@/components/shared/section-header'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function PricingSection() {
  return (
    <section id="planos" className="py-20">
      <PageContainer>
        <SectionHeader title="Escolha o plano ideal para o seu restaurante." description="Comece simples e evolua conforme sua operação cresce." />
        <div className="mt-12 grid gap-6 xl:grid-cols-3">
          {pricingPlans.map((plan) => (
            <div key={plan.name} className={cn('relative rounded-[32px] border bg-white p-6 shadow-sm transition hover:-translate-y-1', plan.highlight ? 'border-orange-400 bg-[linear-gradient(180deg,#fff8ef_0%,#fff_100%)] shadow-[0_24px_70px_rgba(255,107,0,0.16)] xl:scale-[1.03]' : 'border-orange-100 hover:border-orange-300')}>
              {plan.badge ? <span className="absolute right-6 top-6 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">{plan.badge}</span> : null}
              <div className={cn('h-1 w-16 rounded-full bg-orange-500', plan.name !== 'Premium' && 'opacity-0')} />
              <h3 className="mt-5 font-heading text-2xl font-bold text-slate-900">{plan.name}</h3>
              <p className="mt-3 font-heading text-4xl font-extrabold text-slate-900">{plan.price}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{plan.description}</p>
              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 text-orange-500" />{feature}</div>
                ))}
              </div>
              <Button className="mt-8 w-full" onClick={() => toast.success('Plano selecionado. Nossa equipe entrará em contato.')}>{plan.cta}</Button>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-4 rounded-[30px] border border-orange-100 bg-[#fffaf5] p-6 text-center">
          <p className="text-slate-600">Precisa de algo personalizado? Fale com nosso time comercial.</p>
          <Button variant="outline" onClick={() => toast.success('Plano selecionado. Nossa equipe entrará em contato.')}>Solicitar proposta personalizada</Button>
        </div>
      </PageContainer>
    </section>
  )
}
