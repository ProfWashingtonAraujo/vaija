import { CheckCircle2 } from 'lucide-react'
import { testimonials } from '@/data/testimonials'
import { PageContainer } from '@/components/layout/page-container'
import { SectionHeader } from '@/components/shared/section-header'

export function TestimonialsSection() {
  return (
    <section id="depoimentos" className="bg-section py-20">
      <PageContainer constrained>
        <SectionHeader badge="Feita para a rotina real" title="Uma operação mais fluida, em qualquer formato de atendimento." description="A Vaija se adapta aos momentos que mais exigem velocidade e organização do seu restaurante." />
        <div className="mt-12 grid gap-6 xl:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div key={testimonial.name} className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><CheckCircle2 className="h-6 w-6" /></div>
                <div>
                  <p className="font-heading text-xl font-bold text-slate-900">{testimonial.name}</p>
                  <p className="text-sm text-slate-500">{testimonial.type}</p>
                </div>
              </div>
              <p className="mt-5 border-t border-orange-100 pt-5 text-sm leading-7 text-slate-600">{testimonial.quote}</p>
            </div>
          ))}
        </div>
      </PageContainer>
    </section>
  )
}
