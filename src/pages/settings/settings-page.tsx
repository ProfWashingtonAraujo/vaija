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
import { readSettings, saveSettings, type BusinessHour, type DeliverySettings } from '@/lib/settings'
import { planLabels } from '@/lib/plan-access'
import { getTenantForUser } from '@/lib/tenants-api'

const schema = z.object({
  restaurantName: z.string().min(2),
  phone: z.string().min(8),
  pix: z.boolean(),
  card: z.boolean(),
  cash: z.boolean(),
  compactPos: z.boolean(),
  theme: z.string(),
  density: z.enum(['comfortable', 'compact']),
  cardStyle: z.enum(['soft', 'glass', 'solid']),
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
  const storedSettings = readSettings()
  const { register, handleSubmit } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      restaurantName: storedSettings.restaurant.name,
      phone: storedSettings.restaurant.phone,
      pix: storedSettings.payments.pix,
      card: storedSettings.payments.card,
      cash: storedSettings.payments.cash,
      compactPos: storedSettings.preferences.compactPos,
      theme: storedSettings.preferences.theme,
      density: storedSettings.preferences.density,
      cardStyle: storedSettings.preferences.cardStyle,
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
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>(storedSettings.businessHours)
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>(storedSettings.delivery)
  const [restaurantLogo, setRestaurantLogo] = useState(storedSettings.restaurant.logo ?? '')
  const [cepStatus, setCepStatus] = useState<string | null>(null)
  const tenant = getTenantForUser(user)

  useEffect(() => {
    if (!user?.permissions.includes('users:read')) {
      return
    }

    void fetchUsers()
      .then((result) => setUsers(result.users))
      .catch(() => {
        toast.error('Não foi possível carregar os usuários.')
      })
  }, [user])

  const canManageUsers = user?.permissions.includes('users:create') ?? false
  const updateBusinessHour = (index: number, values: Partial<BusinessHour>) => {
    setBusinessHours((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item))
  }
  const updateDeliverySettings = (values: Partial<DeliverySettings>) => {
    setDeliverySettings((current) => ({ ...current, ...values }))
    if (values.originCep !== undefined) {
      setCepStatus(null)
    }
  }

  const validateOriginCep = async () => {
    const cep = deliverySettings.originCep.replace(/\D/g, '')
    if (cep.length !== 8) {
      toast.error('Informe um CEP com 8 dígitos.')
      return
    }

    try {
      const response = await fetch(`https://brasilapi.com.br/api/cep/v2/${cep}`)
      if (!response.ok) {
        throw new Error('CEP inválido')
      }

      const result = await response.json() as { street?: string; neighborhood?: string; city: string; state: string }
      const address = [result.street, result.neighborhood, result.city, result.state].filter(Boolean).join(', ')
      setCepStatus(address)
      toast.success('CEP da pizzaria validado com sucesso.')
    } catch {
      setCepStatus(null)
      toast.error('CEP inválido ou não encontrado.')
    }
  }

  const uploadRestaurantLogo = (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('Envie um arquivo de imagem válido.')
      return
    }

    if (file.size > 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 1 MB.')
      return
    }

    const reader = new FileReader()
    reader.onload = () => {
      setRestaurantLogo(String(reader.result))
      toast.success('Logotipo carregado. Salve as configurações para aplicar.')
    }
    reader.onerror = () => toast.error('Não foi possível carregar o logotipo.')
    reader.readAsDataURL(file)
  }

  return (
    <AdminLayout title="Configurações" description="Ajuste dados do restaurante, operação, usuários e preferências visuais da plataforma.">
      <form
        onSubmit={handleSubmit((values) => {
          saveSettings({
            restaurant: {
              name: values.restaurantName,
              phone: values.phone,
              logo: restaurantLogo || undefined,
            },
            subscription: storedSettings.subscription,
            businessHours,
            delivery: deliverySettings,
            payments: {
              pix: values.pix,
              card: values.card,
              cash: values.cash,
            },
            preferences: {
              compactPos: values.compactPos,
              theme: values.theme,
              density: values.density,
              cardStyle: values.cardStyle,
            },
          })
          toast.success('Configurações salvas com sucesso.')
        })}
        className="grid gap-6"
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)] xl:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Perfil</p>
                <h3 className="mt-1 font-heading text-2xl font-bold text-slate-900">Dados do restaurante</h3>
              </div>
              <p className="max-w-md text-sm text-slate-500">Essas informações aparecem no painel e nas páginas públicas do cliente.</p>
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
              <div className="rounded-[28px] border border-orange-100 bg-white/80 p-4 text-center shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="mx-auto flex h-28 w-28 items-center justify-center overflow-hidden rounded-[28px] border border-orange-100 bg-orange-50 text-orange-700">
                  {restaurantLogo ? <img src={restaurantLogo} alt="Logotipo do restaurante" className="h-full w-full object-cover" /> : <span className="font-heading text-4xl font-bold">V</span>}
                </div>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">Logotipo</p>
                <label className="mt-3 inline-flex cursor-pointer items-center justify-center rounded-2xl border border-orange-200 bg-white px-4 py-2 text-sm font-semibold text-orange-700 transition hover:border-orange-300 hover:bg-orange-50">
                  Enviar logo
                  <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (file) {
                      uploadRestaurantLogo(file)
                    }
                    event.target.value = ''
                  }} />
                </label>
                {restaurantLogo ? <Button type="button" variant="outline" className="mt-2 w-full border-rose-200 text-rose-700 hover:border-rose-300 hover:text-rose-800" onClick={() => setRestaurantLogo('')}>Remover logo</Button> : null}
                <p className="mt-3 text-xs leading-5 text-slate-500">PNG, JPG ou WebP até 1 MB.</p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Nome do restaurante
                  <Input {...register('restaurantName')} placeholder="Nome do restaurante" />
                </label>
                <label className="grid gap-2 text-sm font-semibold text-slate-700">
                  Telefone comercial
                  <Input {...register('phone')} placeholder="Telefone" />
                </label>
                <div className="rounded-[24px] border border-orange-100 bg-orange-50/50 p-4 text-sm leading-6 text-slate-600 md:col-span-2">
                  O logotipo aparece no menu administrativo e na página pública de pedidos. Depois de enviar, clique em <span className="font-semibold text-slate-900">Salvar configurações</span>.
                </div>
              </div>
            </div>
          </section>
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)] xl:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Assinatura</p>
                <h3 className="mt-1 font-heading text-2xl font-bold text-slate-900">Plano contratado</h3>
              </div>
              <p className="max-w-xl text-sm text-slate-500">O plano define quais telas ficam liberadas no painel administrativo.</p>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-[minmax(0,320px)_1fr] md:items-start">
              <div className="rounded-[24px] border border-orange-100 bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Plano atual</p>
                <p className="mt-2 font-heading text-2xl font-bold text-slate-900">{planLabels[tenant.plan]}</p>
                <p className="mt-1 text-sm font-semibold text-orange-700">{tenant.status === 'active' ? 'Assinatura ativa' : 'Assinatura inativa'}</p>
              </div>
              <div className="rounded-[24px] border border-orange-100 bg-orange-50/50 p-4 text-sm leading-6 text-slate-600">
                A alteração de plano/status agora é feita em <span className="font-semibold text-slate-900">Ativação</span>, para simular o controle comercial da assinatura e impedir que o cliente troque o próprio plano.
              </div>
            </div>
          </section>
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)] xl:col-span-2">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Operação</p>
                <h3 className="mt-1 font-heading text-2xl font-bold text-slate-900">Horário de funcionamento</h3>
              </div>
              <p className="max-w-xl text-sm text-slate-500">Defina em quais dias o restaurante recebe pedidos e o intervalo de atendimento.</p>
            </div>
            <div className="mt-6 overflow-hidden rounded-[26px] border border-orange-100 bg-white/75">
              {businessHours.map((item, index) => (
                <div key={item.day} className="grid gap-4 border-b border-orange-50 p-4 last:border-b-0 md:grid-cols-[minmax(0,1fr)_160px_160px_120px] md:items-center">
                  <div className="flex items-center gap-3">
                    <span className={`h-3 w-3 rounded-full ${item.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                    <div>
                      <p className="font-semibold text-slate-900">{item.day}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.enabled ? 'Aberto para pedidos' : 'Fechado'}</p>
                    </div>
                  </div>
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Abre
                    <Input value={item.openTime} onChange={(event) => updateBusinessHour(index, { openTime: event.target.value })} type="time" disabled={!item.enabled} />
                  </label>
                  <label className="grid gap-1 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                    Fecha
                    <Input value={item.closeTime} onChange={(event) => updateBusinessHour(index, { closeTime: event.target.value })} type="time" disabled={!item.enabled} />
                  </label>
                  <label className="flex items-center justify-between rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700 shadow-[0_8px_18px_rgba(255,107,0,0.04)] md:justify-center md:gap-2">
                    {item.enabled ? 'Aberto' : 'Fechado'}
                    <input type="checkbox" checked={item.enabled} onChange={(event) => updateBusinessHour(index, { enabled: event.target.checked })} className="h-4 w-4 accent-orange-500" />
                  </label>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <h3 className="font-heading text-xl font-bold text-slate-900">Taxa de entrega</h3>
            <p className="mt-2 text-sm text-slate-500">Escolha entre taxa fixa ou cobrança por km. Para taxa por km, informe o CEP da pizzaria.</p>
            <div className="mt-5 grid gap-4">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Tipo de cobrança
                <select value={deliverySettings.mode} onChange={(event) => updateDeliverySettings({ mode: event.target.value as DeliverySettings['mode'] })} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
                  <option value="fixed">Taxa fixa</option>
                  <option value="perKm">Taxa por km</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Taxa fixa
                <Input value={deliverySettings.fixedFee} onChange={(event) => updateDeliverySettings({ fixedFee: event.target.value })} placeholder="Ex: 8,00" inputMode="decimal" disabled={deliverySettings.mode !== 'fixed'} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Valor por km
                <Input value={deliverySettings.feePerKm} onChange={(event) => updateDeliverySettings({ feePerKm: event.target.value })} placeholder="Ex: 2,50" inputMode="decimal" disabled={deliverySettings.mode !== 'perKm'} />
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                CEP da pizzaria
                <Input value={deliverySettings.originCep} onChange={(event) => updateDeliverySettings({ originCep: event.target.value })} placeholder="Ex: 01001-000" inputMode="numeric" disabled={deliverySettings.mode !== 'perKm'} />
              </label>
              <Button type="button" variant="outline" onClick={validateOriginCep} disabled={deliverySettings.mode !== 'perKm'}>Verificar CEP</Button>
              {cepStatus ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">CEP válido: {cepStatus}</p> : null}
            </div>
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
            <h3 className="font-heading text-xl font-bold text-slate-900">Preferências do PDV</h3>
            <label className="mt-5 flex items-center justify-between rounded-2xl border border-orange-100 bg-white/80 px-4 py-3 text-sm text-slate-700">
              Interface compacta
              <input type="checkbox" {...register('compactPos')} className="h-4 w-4 accent-orange-500" />
            </label>
          </section>
          <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <h3 className="font-heading text-xl font-bold text-slate-900">Usuários e permissões</h3>
            <div className="mt-5 space-y-3">
              {users.length === 0 ? <div className="rounded-2xl border border-orange-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700">Nenhum usuário carregado.</div> : null}
              {users.map((listedUser) => (
                <div key={listedUser.id} className="rounded-2xl border border-orange-100 bg-white/80 px-4 py-3 text-sm font-medium text-slate-700">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-900">{listedUser.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{listedUser.email}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{listedUser.role}</span>
                      <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{listedUser.shift}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {canManageUsers ? (
              <form
                onSubmit={usersForm.handleSubmit(async (values: UserFormValues) => {
                  try {
                    const result = await createUser(values)
                    setUsers((current) => [...current, result.user])
                    usersForm.reset()
                    toast.success('Usuário criado com sucesso.')
                  } catch (error) {
                    toast.error(error instanceof Error && error.message === 'email_already_exists' ? 'Já existe um usuário com esse e-mail.' : 'Não foi possível criar o usuário.')
                  }
                })}
                className="mt-5 grid gap-3"
              >
                <Input {...usersForm.register('name')} placeholder="Nome do usuário" />
                <Input {...usersForm.register('email')} placeholder="email@empresa.com" />
                <Input {...usersForm.register('shift')} placeholder="Turno" />
                <select {...usersForm.register('roleKey')} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none">
                  <option value="admin">Administrador</option>
                  <option value="manager">Gerente</option>
                  <option value="operator">Operador</option>
                </select>
                <Input type="password" {...usersForm.register('password')} placeholder="Senha inicial" />
                <Button type="submit">Criar usuário</Button>
              </form>
            ) : null}
            <form
              onSubmit={passwordForm.handleSubmit(async (values: PasswordFormValues) => {
                try {
                  await changeOwnPassword(values.currentPassword, values.nextPassword)
                  passwordForm.reset()
                  toast.success('Senha alterada com sucesso.')
                } catch {
                  toast.error('Não foi possível alterar a senha.')
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
            <p className="mt-2 text-sm text-slate-500">Escolha uma combinação visual apropriada para a operação do restaurante.</p>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Tema
                <select {...register('theme')} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
                  <option value="Light Premium">Light Premium</option>
                  <option value="Cozinha Noturna">Cozinha Noturna</option>
                  <option value="Delivery Vibrante">Delivery Vibrante</option>
                  <option value="Clássico Elegante">Clássico Elegante</option>
                  <option value="Alto Contraste">Alto Contraste</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Densidade
                <select {...register('density')} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
                  <option value="comfortable">Confortável</option>
                  <option value="compact">Compacta</option>
                </select>
              </label>
              <label className="grid gap-2 text-sm font-semibold text-slate-700">
                Cartões
                <select {...register('cardStyle')} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
                  <option value="soft">Suave com sombra</option>
                  <option value="glass">Vidro translúcido</option>
                  <option value="solid">Sólido e objetivo</option>
                </select>
              </label>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
              {[
                ['Light Premium', 'Branco quente, laranja e sombras suaves. Melhor para uso geral.'],
                ['Cozinha Noturna', 'Base escura com contraste alto. Boa para telas na cozinha.'],
                ['Delivery Vibrante', 'Laranja forte e cartões chamativos. Bom para operação rápida.'],
                ['Clássico Elegante', 'Neutros, bordas finas e aparência mais refinada.'],
                ['Alto Contraste', 'Leitura máxima para ambientes claros ou monitores distantes.'],
              ].map(([title, description]) => (
                <div key={title} className="rounded-[24px] border border-orange-100 bg-white/80 p-4 text-sm text-slate-600">
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="mt-2 leading-6">{description}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
        <div className="flex justify-end"><Button type="submit">Salvar configurações</Button></div>
      </form>
    </AdminLayout>
  )
}
