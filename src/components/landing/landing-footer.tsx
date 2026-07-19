import { PageContainer } from '@/components/layout/page-container'

export function LandingFooter() {
  return (
    <footer className="border-t border-orange-100 bg-white py-14">
      <PageContainer>
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="font-heading text-2xl font-bold text-slate-900">Vaija</p>
            <p className="mt-3 font-medium text-orange-700">Gestão gastronômica em movimento.</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">Plataforma premium de PDV, delivery, cardápio digital e gestão para restaurantes modernos.</p>
          </div>
          <div><p className="font-heading text-lg font-bold text-slate-900">Produto</p><div className="mt-4 space-y-3 text-sm text-slate-600"><p>Dashboard</p><p>PDV</p><p>Cardápio</p><p>Pedidos</p><p>Relatórios</p></div></div>
          <div><p className="font-heading text-lg font-bold text-slate-900">Empresa</p><div className="mt-4 space-y-3 text-sm text-slate-600"><p>Sobre</p><p>Planos</p><p>Contato</p><p>Demonstração</p></div></div>
          <div><p className="font-heading text-lg font-bold text-slate-900">Legal</p><div className="mt-4 space-y-3 text-sm text-slate-600"><p>Termos de Uso</p><p>Política de Privacidade</p></div></div>
        </div>
        <p className="mt-12 border-t border-orange-100 pt-6 text-sm text-slate-500">© 2024 Vaija. Todos os direitos reservados.</p>
      </PageContainer>
    </footer>
  )
}
