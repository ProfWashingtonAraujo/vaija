import { useEffect, useState, type FormEvent } from 'react'
import { LifeBuoy, MessageCircle } from 'lucide-react'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion'
import { useAuth, useTenant } from '@/contexts/auth-context'
import { supportFaq } from '@/data/support-faq'
import { createTicket, fetchMyTickets, supportWhatsappUrl, type SupportTicket, type TicketPriority, type TicketStatus } from '@/lib/support-api'
import { usePolling } from '@/lib/use-polling'

const statusStyles: Record<TicketStatus, string> = {
  Aberto: 'bg-sa-warn-soft text-sa-warn',
  'Em atendimento': 'bg-sa-info-soft text-sa-info',
  Resolvido: 'bg-sa-ok-soft text-sa-ok',
}

const fieldClass = 'rounded-2xl border border-sa-border bg-sa-surface px-4 text-sm text-sa-text outline-none focus:border-sa-accent focus:ring-4 focus:ring-sa-accent/20'

export function SupportPage() {
  const { user } = useAuth()
  const tenant = useTenant()
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [priority, setPriority] = useState<TicketPriority>('Média')
  const [sending, setSending] = useState(false)

  const load = () => fetchMyTickets().then(setTickets)

  useEffect(() => {
    void load().catch(() => toast.error('Não foi possível carregar seus chamados.'))
  }, [])

  usePolling(() => load().catch(() => undefined), 30_000)

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!subject.trim()) {
      toast.error('Informe o assunto do chamado.')
      return
    }
    setSending(true)
    try {
      await createTicket({ subject: subject.trim(), message: message.trim(), priority })
      setSubject('')
      setMessage('')
      setPriority('Média')
      await load()
      toast.success('Chamado enviado. A resposta aparece aqui na lista.')
    } catch {
      toast.error('Não foi possível enviar o chamado. Tente de novo.')
    } finally {
      setSending(false)
    }
  }

  const whatsappText = `Olá! Preciso de ajuda com o Vaija. Loja: ${tenant.restaurantName}${user?.name ? ` (${user.name})` : ''}.`

  return (
    <AdminLayout title="Suporte" description="Tire dúvidas, fale com a gente e acompanhe seus chamados.">
      <div className="grid items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-sa-border bg-sa-surface p-6 shadow-sa">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sa-ok-soft text-sa-ok"><MessageCircle className="h-5 w-5" /></div>
            <h2 className="mt-4 font-heading text-xl font-bold text-sa-text">Fale com a gente no WhatsApp</h2>
            <p className="mt-1 text-sm text-sa-muted">Para dúvidas rápidas e problemas urgentes na operação.</p>
            <Button type="button" className="mt-5 w-full" onClick={() => window.open(supportWhatsappUrl(whatsappText), '_blank', 'noopener,noreferrer')}>Abrir WhatsApp</Button>
          </section>

          <form onSubmit={submit} className="rounded-2xl border border-sa-border bg-sa-surface p-6 shadow-sa">
            <h2 className="font-heading text-xl font-bold text-sa-text">Abrir chamado</h2>
            <p className="mt-1 text-sm text-sa-muted">Para algo que precisa de acompanhamento.</p>
            <div className="mt-5 grid gap-3">
              <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder="Assunto" maxLength={120} />
              <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Descreva o que aconteceu" maxLength={2000} rows={4} className={`${fieldClass} resize-none py-3`} />
              <select value={priority} onChange={(event) => setPriority(event.target.value as TicketPriority)} aria-label="Prioridade" className={`${fieldClass} h-11`}>
                <option value="Baixa">Prioridade baixa</option>
                <option value="Média">Prioridade média</option>
                <option value="Alta">Prioridade alta</option>
              </select>
            </div>
            <Button type="submit" disabled={sending} className="mt-5 w-full">{sending ? 'Enviando...' : 'Enviar chamado'}</Button>
          </form>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-sa-border bg-sa-surface p-6 shadow-sa">
            <h2 className="font-heading text-xl font-bold text-sa-text">Meus chamados</h2>
            <div className="mt-5 space-y-3">
              {tickets.map((ticket) => (
                <div key={ticket.id} className="rounded-2xl border border-sa-border bg-sa-surface-2 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-sa-text">{ticket.subject}</p>
                      <p className="mt-1 text-xs text-sa-muted">{new Date(ticket.createdAt).toLocaleString('pt-BR')} · {ticket.priority}{ticket.createdBy ? ` · ${ticket.createdBy}` : ''}</p>
                    </div>
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusStyles[ticket.status]}`}>{ticket.status}</span>
                  </div>
                  {ticket.message ? <p className="mt-3 whitespace-pre-wrap text-sm text-sa-text-2">{ticket.message}</p> : null}
                  {ticket.reply ? (
                    <div className="mt-3 rounded-xl border border-sa-border bg-sa-ok-soft p-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-sa-ok">Resposta do suporte</p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-sa-text-2">{ticket.reply}</p>
                    </div>
                  ) : null}
                </div>
              ))}
              {tickets.length === 0 ? (
                <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-sa-border bg-sa-surface-2 p-6 text-center text-sm font-semibold text-sa-muted">
                  <LifeBuoy className="h-5 w-5 text-sa-accent-text" />
                  Você ainda não abriu nenhum chamado.
                </div>
              ) : null}
            </div>
          </section>

          <section className="rounded-2xl border border-sa-border bg-sa-surface p-6 shadow-sa">
            <h2 className="font-heading text-xl font-bold text-sa-text">Perguntas frequentes</h2>
            <Accordion type="single" collapsible className="mt-3">
              {supportFaq.map((item, index) => (
                <AccordionItem key={item.question} value={`item-${index}`} className="border-b border-sa-border last:border-none">
                  <AccordionTrigger>{item.question}</AccordionTrigger>
                  <AccordionContent>{item.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </section>
        </div>
      </div>
    </AdminLayout>
  )
}
