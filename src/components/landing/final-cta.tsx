import { PageContainer } from '@/components/layout/page-container'
import { Button } from '@/components/ui/button'

export function FinalCTA() {
  return (
    <section className="py-20">
      <PageContainer>
        <div className="rounded-[36px] border border-orange-700 bg-[linear-gradient(135deg,#ff6b00_0%,#ff7e1f_55%,#ff9340_100%)] px-6 py-12 text-white shadow-[0_30px_80px_rgba(255,107,0,0.28)] lg:px-12">
          <div className="grid items-center gap-8 lg:grid-cols-[1fr_auto]">
            <div>
              <h2 className="font-heading text-4xl font-extrabold tracking-tight md:text-5xl">Pronto para transformar a gestao do seu restaurante?</h2>
              <p className="mt-4 max-w-2xl text-orange-50">Organize pedidos, acelere o atendimento e tenha mais controle sobre sua operação com a Vaija.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
              <Button className="border-white bg-white text-orange-700 shadow-[0_16px_30px_rgba(255,255,255,0.22)] hover:bg-orange-50">Começar agora</Button>
              <a href="#dashboard"><Button variant="outline" className="border-orange-200 bg-white/10 text-white hover:bg-white/20">Ver demonstração</Button></a>
            </div>
          </div>
        </div>
      </PageContainer>
    </section>
  )
}
