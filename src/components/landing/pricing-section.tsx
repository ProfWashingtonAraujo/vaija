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
      <PageContainer constrained>
        <SectionHeader title="Escolha o plano ideal para o seu restaurante." description="Comece simples e evolua conforme sua operação cresce." />
        <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plans.map((plan) => (
            <div key={plan.name} className={cn('relative rounded-[26px] border bg-white p-4 shadow-sm transition hover:-translate-y-1 sm:p-5', plan.highlight ? 'border-orange-400 bg-[linear-gradient(180deg,#fff8ef_0%,#fff_100%)] shadow-[0_18px_46px_rgba(255,107,0,0.14)]' : 'border-orange-100 hover:border-orange-300')}>
              {plan.badge ? <span className="absolute right-4 top-4 rounded-full bg-orange-500 px-2.5 py-1 text-[11px] font-semibold text-white">{plan.badge}</span> : null}
              <div className={cn('h-1 w-12 rounded-full bg-orange-500', plan.name !== 'Premium' && 'opacity-0')} />
              <h3 className="mt-4 font-heading text-xl font-bold text-slate-900">{plan.name}</h3>
              <p className="mt-2 font-heading text-3xl font-extrabold text-slate-900">{plan.price}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{plan.description}</p>
              <div className="mt-4 rounded-[20px] border border-orange-100 bg-orange-50/50 p-3">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-700">Telas inclusas</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {plan.screens.map((screen) => (
                    <span key={screen} className="rounded-full border border-orange-100 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700">{screen}</span>
                  ))}
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2 text-sm leading-5 text-slate-700"><Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-orange-500" />{feature}</div>
                ))}
              </div>
              <Link to={`/comprar?plano=${encodeURIComponent(plan.name)}`}><Button className="mt-6 w-full px-3 text-sm">{plan.cta}</Button></Link>
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
