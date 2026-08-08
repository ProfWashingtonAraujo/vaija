import { PageContainer } from '@/components/layout/page-container'

export function LandingFooter() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="border-t border-orange-100 bg-white py-14">
      <PageContainer constrained>
        <div className="grid gap-10 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="font-heading text-2xl font-bold text-slate-900">Vaija</p>
            <p className="mt-3 font-medium text-orange-700">Gestão gastronômica em movimento.</p>
            <p className="mt-4 text-sm leading-7 text-slate-600">Plataforma premium de PDV, delivery, cardápio digital e gestão para restaurantes modernos.</p>
          </div>
          <div><p className="font-heading text-lg font-bold text-slate-900">Produto</p><div className="mt-4 flex flex-col items-start gap-3 text-sm text-slate-600"><a href="#dashboard" className="hover:text-orange-600">Painel geral</a><a href="#recursos" className="hover:text-orange-600">Recursos</a><a href="#planos" className="hover:text-orange-600">Planos</a></div></div>
          <div><p className="font-heading text-lg font-bold text-slate-900">Conheça</p><div className="mt-4 flex flex-col items-start gap-3 text-sm text-slate-600"><a href="#inicio" className="hover:text-orange-600">Sobre a Vaija</a><a href="#depoimentos" className="hover:text-orange-600">Casos de uso</a><a href="#faq" className="hover:text-orange-600">Perguntas frequentes</a></div></div>
          <div><p className="font-heading text-lg font-bold text-slate-900">Legal</p><div className="mt-4 space-y-3 text-sm text-slate-600"><p>Termos de Uso</p><p>Política de Privacidade</p></div></div>
        </div>
        <p className="mt-12 border-t border-orange-100 pt-6 text-sm text-slate-500">© {currentYear} Vaija. Todos os direitos reservados.</p>
      </PageContainer>
    </footer>
  )
}
