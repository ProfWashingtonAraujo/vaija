import { AnimatedCounter } from '@/components/shared/animated-counter'
import { PageContainer } from '@/components/layout/page-container'

export function MetricsSection() {
  return (
    <section className="py-8">
      <PageContainer constrained>
        <div className="grid gap-4 rounded-[34px] border border-orange-100 bg-white p-6 shadow-sm md:grid-cols-2 xl:grid-cols-4">
          <div><p className="font-heading text-4xl font-extrabold text-orange-500"><AnimatedCounter value={1} /></p><p className="mt-2 text-sm text-slate-600">painel para toda a operação</p></div>
          <div><p className="font-heading text-4xl font-extrabold text-orange-500"><AnimatedCounter value={3} /></p><p className="mt-2 text-sm text-slate-600">canais: delivery, salão e balcão</p></div>
          <div><p className="font-heading text-4xl font-extrabold text-orange-500">Ao vivo</p><p className="mt-2 text-sm text-slate-600">pedidos e indicadores em tempo real</p></div>
          <div><p className="font-heading text-4xl font-extrabold text-orange-500"><AnimatedCounter value={100} suffix="%" /></p><p className="mt-2 text-sm text-slate-600">responsivo em desktop e celular</p></div>
        </div>
      </PageContainer>
    </section>
  )
}
