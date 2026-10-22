import { Link } from 'react-router-dom'
import { LifeBuoy, LockKeyhole } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/auth-context'
import type { SubscriptionStatus } from '@/lib/billing-api'

const reasons: Partial<Record<SubscriptionStatus, { title: string; text: string }>> = {
  trialing: { title: 'Seu teste grátis terminou', text: 'Para continuar usando o painel, pague a primeira mensalidade.' },
  past_due: { title: 'Mensalidade em atraso', text: 'O pagamento não foi identificado e o prazo de tolerância acabou. Regularize para voltar a usar o painel.' },
  cancelled: { title: 'Assinatura cancelada', text: 'Para voltar a usar o painel, escolha um plano e contrate de novo.' },
}

export function BillingBlocked({ status }: { status: SubscriptionStatus }) {
  const { user, logout } = useAuth()
  const reason = reasons[status] ?? reasons.past_due!
  const isOwner = user?.roleKey === 'admin'

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-center">
      <div className="w-full max-w-md rounded-[30px] border border-orange-100 bg-white p-8 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><LockKeyhole className="h-6 w-6" /></div>
        <h1 className="mt-5 font-heading text-2xl font-bold text-slate-900">{reason.title}</h1>
        <p className="mt-3 text-sm leading-6 text-slate-500">{reason.text}</p>
        <p className="mt-3 text-sm leading-6 text-slate-500">O cardápio online da loja continua no ar para os seus clientes.</p>
        <div className="mt-6 grid gap-3">
          {isOwner ? (
            <Link to="/subscription"><Button className="w-full">Regularizar assinatura</Button></Link>
          ) : (
            <p className="rounded-2xl border border-orange-100 bg-orange-50/60 p-3 text-sm font-medium text-slate-600">Peça ao administrador da loja para regularizar a assinatura.</p>
          )}
          <Link to="/support" className="inline-flex items-center justify-center gap-2 text-sm font-semibold text-orange-600 hover:text-orange-700"><LifeBuoy className="h-4 w-4" />Falar com o suporte</Link>
          <button type="button" onClick={() => void logout()} className="text-sm font-medium text-slate-400 underline hover:text-slate-600">Sair</button>
        </div>
      </div>
    </div>
  )
}
