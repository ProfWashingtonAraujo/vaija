import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getPricingPlans } from '@/data/pricing-plans'
import { PageContainer } from '@/components/layout/page-container'
import { SectionHeader } from '@/components/shared/section-header'
import { Button } from '@/components/ui/button'
import { planConfigsUpdatedEvent } from '@/lib/saas-admin-api'
import { cn } from '@/lib/utils'

export function PricingSection() {
  const [plans, setPlans] = useState(() => getPricingPlans())

  useEffect(() => {
    const refreshPlans = () => setPlans(getPricingPlans())
    window.addEventListener(planConfigsUpdatedEvent, refreshPlans)
    return () => window.removeEventListener(planConfigsUpdatedEvent, refreshPlans)
  }, [])

  return (
    <section id="planos" className="py-20">
      <PageContainer>
        <SectionHeader title="Escolha o plano ideal para o seu restaurante." description="Comece simples e evolua conforme sua operação cresce." />
        <div className="mt-12 grid gap-6 xl:grid-cols-3">
          {plans.map((plan) => (
            <div key={plan.name} className={cn('relative rounded-[32px] border bg-white p-6 shadow-sm transition hover:-translate-y-1', plan.highlight ? 'border-orange-400 bg-[linear-gradient(180deg,#fff8ef_0%,#fff_100%)] shadow-[0_24px_70px_rgba(255,107,0,0.16)] xl:scale-[1.03]' : 'border-orange-100 hover:border-orange-300')}>
              {plan.badge ? <span className="absolute right-6 top-6 rounded-full bg-orange-500 px-3 py-1 text-xs font-semibold text-white">{plan.badge}</span> : null}
              <div className={cn('h-1 w-16 rounded-full bg-orange-500', plan.name !== 'Premium' && 'opacity-0')} />
              <h3 className="mt-5 font-heading text-2xl font-bold text-slate-900">{plan.name}</h3>
              <p className="mt-3 font-heading text-4xl font-extrabold text-slate-900">{plan.price}</p>
              <p className="mt-3 text-sm leading-7 text-slate-600">{plan.description}</p>
              <div className="mt-6 rounded-[24px] border border-orange-100 bg-orange-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Telas inclusas</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {plan.screens.map((screen) => (
                    <span key={screen} className="rounded-full border border-orange-100 bg-white px-3 py-1 text-xs font-semibold text-slate-700">{screen}</span>
                  ))}
                </div>
              </div>
              <div className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3 text-sm text-slate-700"><Check className="mt-0.5 h-4 w-4 text-orange-500" />{feature}</div>
                ))}
              </div>
              <Link to={`/comprar?plano=${encodeURIComponent(plan.name)}`}><Button className="mt-8 w-full">{plan.cta}</Button></Link>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-4 rounded-[30px] border border-orange-100 bg-[#fffaf5] p-6 text-center">
          <p className="text-slate-600">Precisa de algo personalizado? Fale com nosso time comercial.</p>
          <Link to="/comprar?plano=Premium"><Button variant="outline">Solicitar proposta personalizada</Button></Link>
        </div>
      </PageContainer>
    </section>
  )
}
