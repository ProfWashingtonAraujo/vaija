import { AnimatedCounter } from '@/components/shared/animated-counter'
import { PageContainer } from '@/components/layout/page-container'

export function MetricsSection() {
  return (
    <section className="py-8">
      <PageContainer>
        <div className="grid gap-4 rounded-[34px] border border-orange-100 bg-white p-6 shadow-sm md:grid-cols-2 xl:grid-cols-4">
          <div><p className="font-heading text-4xl font-extrabold text-orange-500"><AnimatedCounter value={42} prefix="+" suffix="%" /></p><p className="mt-2 text-sm text-slate-600">mais agilidade no atendimento</p></div>
          <div><p className="font-heading text-4xl font-extrabold text-orange-500"><AnimatedCounter value={35} prefix="-" suffix="%" /></p><p className="mt-2 text-sm text-slate-600">menos erros operacionais</p></div>
          <div><p className="font-heading text-4xl font-extrabold text-orange-500"><AnimatedCounter value={3} suffix="x" /></p><p className="mt-2 text-sm text-slate-600">mais clareza na gestao</p></div>
          <div><p className="font-heading text-4xl font-extrabold text-orange-500"><AnimatedCounter value={100} suffix="%" /></p><p className="mt-2 text-sm text-slate-600">focado em restaurantes</p></div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">Metricas ilustrativas baseadas em ganhos operacionais esperados.</p>
      </PageContainer>
    </section>
  )
}
