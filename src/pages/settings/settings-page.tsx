import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const schema = z.object({
  restaurantName: z.string().min(2),
  phone: z.string().min(8),
  openTime: z.string(),
  closeTime: z.string(),
  deliveryFee: z.string(),
  pix: z.boolean(),
  card: z.boolean(),
  cash: z.boolean(),
  compactPos: z.boolean(),
  theme: z.string(),
})

type FormValues = z.infer<typeof schema>

export function SettingsPage() {
  const { register, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      restaurantName: 'Taperas Pizzaria',
      phone: '(11) 4002-8922',
      openTime: '17:00',
      closeTime: '23:30',
      deliveryFee: '8,00',
      pix: true,
      card: true,
      cash: true,
      compactPos: true,
      theme: 'Light Premium',
    },
  })

  return (
    <AdminLayout title="Configurações" description="Ajuste dados do restaurante, operação, usuários e preferências visuais da plataforma.">
      <form onSubmit={handleSubmit(() => toast.success('Configurações salvas com sucesso.'))} className="grid gap-6">
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <h3 className="font-heading text-xl font-bold text-slate-900">Dados do restaurante</h3>
            <div className="mt-5 grid gap-4">
              <Input {...register('restaurantName')} placeholder="Nome do restaurante" />
              <Input {...register('phone')} placeholder="Telefone" />
            </div>
          </section>
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <h3 className="font-heading text-xl font-bold text-slate-900">Horário de funcionamento</h3>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <Input {...register('openTime')} type="time" />
              <Input {...register('closeTime')} type="time" />
            </div>
          </section>
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <h3 className="font-heading text-xl font-bold text-slate-900">Taxa de entrega</h3>
            <div className="mt-5"><Input {...register('deliveryFee')} placeholder="R$ 0,00" /></div>
          </section>
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <h3 className="font-heading text-xl font-bold text-slate-900">Métodos de pagamento</h3>
            <div className="mt-5 grid gap-3 text-sm text-slate-700">
              {[
                ['pix', 'Pix'],
                ['card', 'Cartão'],
                ['cash', 'Dinheiro'],
              ].map(([field, label]) => (
                <label key={field} className="flex items-center justify-between rounded-2xl border border-orange-100 bg-white/80 px-4 py-3">
                  {label}
                  <input type="checkbox" {...register(field as 'pix' | 'card' | 'cash')} className="h-4 w-4 accent-orange-500" />
                </label>
              ))}
            </div>
          </section>
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <h3 className="font-heading text-xl font-bold text-slate-900">Preferencias do PDV</h3>
            <label className="mt-5 flex items-center justify-between rounded-2xl border border-orange-100 bg-white/80 px-4 py-3 text-sm text-slate-700">
              Interface compacta
              <input type="checkbox" {...register('compactPos')} className="h-4 w-4 accent-orange-500" />
            </label>
          </section>
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <h3 className="font-heading text-xl font-bold text-slate-900">Usuários e permissões</h3>
            <div className="mt-5 space-y-3">
               {['Washington - Admin', 'Camila - Caixa', 'Gustavo - Cozinha'].map((user) => <div key={user} className="rounded-2xl border border-orange-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700">{user}</div>)}
             </div>
          </section>
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)] xl:col-span-2">
            <h3 className="font-heading text-xl font-bold text-slate-900">Aparência do sistema</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Input {...register('theme')} />
              <div className="rounded-[24px] border border-orange-200 bg-[#fffaf5] p-4 text-sm text-slate-600">Tema atual: Light premium com destaque em contornos laranja.</div>
            </div>
          </section>
        </div>
        <div className="flex justify-end"><Button type="submit">Salvar configurações</Button></div>
      </form>
    </AdminLayout>
  )
}
