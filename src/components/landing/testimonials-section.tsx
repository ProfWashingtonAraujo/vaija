import { Star } from 'lucide-react'
import { testimonials } from '@/data/testimonials'
import { PageContainer } from '@/components/layout/page-container'
import { SectionHeader } from '@/components/shared/section-header'

export function TestimonialsSection() {
  return (
    <section id="depoimentos" className="bg-section py-20">
      <PageContainer>
        <SectionHeader title="Restaurantes ficticios que ja operam melhor com a Vaija." description="Depoimentos demonstrativos para apresentar o valor comercial da plataforma." />
        <div className="mt-12 grid gap-6 xl:grid-cols-3">
          {testimonials.map((testimonial) => (
            <div key={testimonial.name} className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 font-heading text-xl font-bold text-orange-700">{testimonial.name[0]}</div>
                <div>
                  <p className="font-heading text-xl font-bold text-slate-900">{testimonial.name}</p>
                  <p className="text-sm text-slate-500">{testimonial.type}</p>
                </div>
              </div>
              <div className="mt-5 flex gap-1 text-orange-500">{Array.from({ length: 5 }).map((_, index) => <Star key={index} className="h-4 w-4 fill-current" />)}</div>
              <p className="mt-5 text-sm leading-7 text-slate-600">“{testimonial.quote}”</p>
            </div>
          ))}
        </div>
      </PageContainer>
    </section>
  )
}
