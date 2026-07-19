import { faqItems } from '@/data/faq'
import { PageContainer } from '@/components/layout/page-container'
import { SectionHeader } from '@/components/shared/section-header'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'

export function FAQSection() {
  return (
    <section id="faq" className="py-20">
      <PageContainer>
        <SectionHeader title="Perguntas frequentes" description="Respostas objetivas para acelerar a apresentacao comercial da Vaija." />
        <div className="mx-auto mt-12 max-w-4xl rounded-[30px] border border-orange-100 bg-white shadow-sm">
          <Accordion type="single" collapsible>
            {faqItems.map((item, index) => (
              <AccordionItem key={item.question} value={`item-${index}`} className="border-b border-orange-50 last:border-none">
                <AccordionTrigger>{item.question}</AccordionTrigger>
                <AccordionContent>{item.answer}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </PageContainer>
    </section>
  )
}
