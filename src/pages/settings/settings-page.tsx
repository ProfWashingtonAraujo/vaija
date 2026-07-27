import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { useAuth } from '@/contexts/auth-context'
import { changeOwnPassword, createUser, fetchUsers, type AppUser } from '@/lib/users-api'
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

const userSchema = z.object({
  name: z.string().min(2),
  email: z.email(),
  shift: z.string().min(2),
  roleKey: z.enum(['admin', 'manager', 'operator']),
  password: z.string().min(6),
})

const passwordSchema = z.object({
  currentPassword: z.string().min(6),
  nextPassword: z.string().min(6),
})

type UserFormValues = z.infer<typeof userSchema>
type PasswordFormValues = z.infer<typeof passwordSchema>

export function SettingsPage() {
  const { user } = useAuth()
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
  const usersForm = useForm<UserFormValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      name: '',
      email: '',
      shift: 'Caixa 02 - Fechado',
      roleKey: 'operator',
      password: '',
    },
  })
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      nextPassword: '',
    },
  })
  const [users, setUsers] = useState<AppUser[]>([])

  useEffect(() => {
    if (!user?.permissions.includes('users:read')) {
      return
    }

    void fetchUsers()
      .then((result) => setUsers(result.users))
      .catch(() => {
        toast.error('Nao foi possivel carregar os usuarios.')
      })
  }, [user])

  const canManageUsers = user?.permissions.includes('users:create') ?? false

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
              {users.length === 0 ? <div className="rounded-2xl border border-orange-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700">Nenhum usuario carregado.</div> : null}
              {users.map((listedUser) => <div key={listedUser.id} className="rounded-2xl border border-orange-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700">{listedUser.name} - {listedUser.role} - {listedUser.shift}</div>)}
            </div>
            {canManageUsers ? (
              <form
                onSubmit={usersForm.handleSubmit(async (values) => {
                  try {
                    const result = await createUser(values)
                    setUsers((current) => [...current, result.user])
                    usersForm.reset()
                    toast.success('Usuario criado com sucesso.')
                  } catch {
                    toast.error('Nao foi possivel criar o usuario.')
                  }
                })}
                className="mt-5 grid gap-3"
              >
                <Input {...usersForm.register('name')} placeholder="Nome do usuario" />
                <Input {...usersForm.register('email')} placeholder="email@empresa.com" />
                <Input {...usersForm.register('shift')} placeholder="Turno" />
                <select {...usersForm.register('roleKey')} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none">
                  <option value="admin">Administrador</option>
                  <option value="manager">Gerente</option>
                  <option value="operator">Operador</option>
                </select>
                <Input type="password" {...usersForm.register('password')} placeholder="Senha inicial" />
                <Button type="submit">Criar usuario</Button>
              </form>
            ) : null}
            <form
              onSubmit={passwordForm.handleSubmit(async (values) => {
                try {
                  await changeOwnPassword(values.currentPassword, values.nextPassword)
                  passwordForm.reset()
                  toast.success('Senha alterada com sucesso.')
                } catch {
                  toast.error('Nao foi possivel alterar a senha.')
                }
              })}
              className="mt-5 grid gap-3"
            >
              <Input type="password" {...passwordForm.register('currentPassword')} placeholder="Senha atual" />
              <Input type="password" {...passwordForm.register('nextPassword')} placeholder="Nova senha" />
              <Button type="submit" variant="outline">Alterar minha senha</Button>
            </form>
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
