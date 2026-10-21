import { defaultBrandColor, normalizeHex } from '@/lib/brand'
import { useEffect, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'
import { AdminLayout } from '@/components/layout/admin-layout'
import { useAuth } from '@/contexts/auth-context'
import { changeOwnPassword, createUser, fetchUsers, type AppUser } from '@/lib/users-api'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Plus, X } from 'lucide-react'
import { pushSettingsToServer, readSettings, saveSettings, syncSettingsFromServer, type BusinessHour, type DeliverySettings } from '@/lib/settings'
import { planLabels } from '@/lib/plan-access'
import { getTenantForUser } from '@/lib/tenants-api'
import { getPublicOrderUrl } from '@/lib/public-order-url'
import { userErrorMessage, usernameHint, usernamePattern } from '@/lib/username'
import { cn } from '@/lib/utils'

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
  username: z.string().trim().toLowerCase().regex(usernamePattern, usernameHint),
  email: z.email().or(z.literal('')),
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

const sections = [
  ['restaurante', 'Restaurante'],
  ['horarios', 'Horários'],
  ['entrega', 'Entrega e pagamento'],
  ['mesas', 'Mesas'],
  ['equipe', 'Equipe'],
  ['conta', 'Minha conta'],
  ['aparencia', 'Aparência'],
] as const

type SectionKey = (typeof sections)[number][0]

const themeDescriptions: Record<string, string> = {
  'Light Premium': 'Branco quente, laranja e sombras suaves. Melhor para uso geral.',
  'Cozinha Noturna': 'Base escura com contraste alto. Boa para telas na cozinha.',
  'Delivery Vibrante': 'Laranja forte e cartões chamativos. Bom para operação rápida.',
  'Clássico Elegante': 'Neutros, bordas finas e aparência mais refinada.',
  'Alto Contraste': 'Leitura máxima para ambientes claros ou monitores distantes.',
}

const panelClass = 'rounded-xl border border-slate-200 bg-white px-5 sm:px-6'
const fieldClass = 'h-10 rounded-lg border-slate-200 focus:translate-y-0 focus:ring-2'
const selectClass = 'h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100'
const primaryButtonClass = 'rounded-lg shadow-none hover:translate-y-0'
const outlineButtonClass = 'rounded-lg border-slate-200 hover:border-slate-300 hover:text-slate-900'

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-2 border-b border-slate-100 py-4 last:border-b-0 sm:grid-cols-[200px_minmax(0,1fr)] sm:items-center sm:gap-8">
      <div>
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
      </div>
      <div className="min-w-0 sm:max-w-md">{children}</div>
    </div>
  )
}

function GroupTitle({ children }: { children: ReactNode }) {
  return <h3 className="pb-1 pt-6 text-xs font-semibold uppercase tracking-wide text-slate-400 first:pt-5">{children}</h3>
}

function Toggle({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <span className={cn('relative inline-flex h-5 w-9 shrink-0', className)}>
      <input type="checkbox" role="switch" className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none rounded-full opacity-0 disabled:cursor-not-allowed" {...props} />
      <span className="pointer-events-none h-5 w-9 rounded-full bg-slate-200 transition-colors peer-checked:bg-orange-500 peer-focus-visible:ring-2 peer-focus-visible:ring-orange-200 peer-disabled:opacity-50" />
      <span className="pointer-events-none absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-4" />
    </span>
  )
}

export function SettingsPage() {
  const [synced, setSynced] = useState(false)

  // o servidor é a fonte da verdade: carrega antes de montar o formulário, que lê o valor inicial uma vez só
  useEffect(() => {
    void syncSettingsFromServer().catch(() => undefined).finally(() => setSynced(true))
  }, [])

  if (!synced) {
    return <AdminLayout title="Configurações" description="Carregando configurações do restaurante..."><div className="h-40 animate-pulse rounded-xl bg-slate-100" /></AdminLayout>
  }

  return <SettingsForm />
}

function SettingsForm() {
  const { user } = useAuth()
  const storedSettings = readSettings()
  const { register, handleSubmit, watch, reset, formState: { isDirty, isSubmitting } } = useForm<FormValues>({
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
      username: '',
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
  const [section, setSection] = useState<SectionKey>('restaurante')
  const [users, setUsers] = useState<AppUser[]>([])
  const [showUserForm, setShowUserForm] = useState(false)
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>(storedSettings.businessHours)
  const [deliverySettings, setDeliverySettings] = useState<DeliverySettings>(storedSettings.delivery)
  const [tables, setTables] = useState<string[]>(storedSettings.tables)
  const [restaurantLogo, setRestaurantLogo] = useState(storedSettings.restaurant.logo ?? '')
  const [brandColor, setBrandColor] = useState(normalizeHex(storedSettings.restaurant.brandColor))
  const [cepStatus, setCepStatus] = useState<string | null>(null)
  const tenant = getTenantForUser(user)
  const publicOrderUrl = user ? getPublicOrderUrl(user.tenantId) : ''

  // campos fora do react-hook-form (horários, entrega e logo) são comparados com o último estado salvo
  const localSnapshot = JSON.stringify({ businessHours, delivery: deliverySettings, tables, logo: restaurantLogo, brandColor })
  const [savedSnapshot, setSavedSnapshot] = useState(localSnapshot)
  const dirty = isDirty || localSnapshot !== savedSnapshot

  const copyPublicOrderUrl = async () => {
    try {
      await navigator.clipboard.writeText(publicOrderUrl)
      toast.success('Link público copiado.')
    } catch {
      toast.error('Não foi possível copiar o link.')
    }
  }

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
  const applyHoursToAll = () => {
    const reference = businessHours.find((item) => item.enabled)
    if (!reference) {
      return
    }
    setBusinessHours((current) => current.map((item) => ({ ...item, openTime: reference.openTime, closeTime: reference.closeTime })))
  }
  const nextTableNumber = (current: string[]) => Math.max(0, ...current.map(Number).filter(Number.isFinite)) + 1
  const addTable = () => setTables((current) => [...current, String(nextTableNumber(current))])
  const updateTable = (index: number, name: string) => setTables((current) => current.map((item, itemIndex) => itemIndex === index ? name : item))
  const removeTable = (index: number) => setTables((current) => current.filter((_, itemIndex) => itemIndex !== index))
  const setTableCount = (count: number) => {
    const total = Math.min(100, Math.max(0, Math.floor(count) || 0))
    setTables((current) => {
      const next = current.slice(0, total)
      while (next.length < total) next.push(String(nextTableNumber(next)))
      return next
    })
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

  const selectedTheme = watch('theme')

  return (
    <AdminLayout title="Configurações" description="Restaurante, operação, equipe e preferências.">
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[176px_minmax(0,1fr)] lg:gap-10">
        <nav aria-label="Seções de configurações" className="-mx-1 flex gap-1 overflow-x-auto px-1 lg:sticky lg:top-4 lg:mx-0 lg:flex-col lg:self-start lg:overflow-visible lg:px-0">
          {sections.map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSection(key)}
              aria-current={section === key ? 'page' : undefined}
              className={cn(
                'whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                section === key ? 'bg-orange-50 text-orange-700' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
              )}
            >
              {label}
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          <form
            id="settings-form"
            onSubmit={handleSubmit(async (values) => {
              const cleanTables = tables.map((name) => name.trim()).filter(Boolean)
              if (new Set(cleanTables.map((name) => name.toLowerCase())).size !== cleanTables.length) {
                toast.error('Há mesas com o mesmo nome. Cada mesa precisa de um nome diferente.')
                setSection('mesas')
                return
              }
              const nextSettings = {
                restaurant: {
                  name: values.restaurantName,
                  phone: values.phone,
                  logo: restaurantLogo || undefined,
                  brandColor,
                },
                subscription: storedSettings.subscription,
                businessHours,
                delivery: deliverySettings,
                tables: cleanTables,
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
              }
              saveSettings(nextSettings)
              try {
                await pushSettingsToServer(nextSettings)
                reset(values)
                setSavedSnapshot(localSnapshot)
                toast.success('Configurações salvas com sucesso.')
              } catch {
                toast.error('Salvo só neste navegador: não foi possível enviar ao servidor. Seus clientes não verão a mudança até salvar de novo.')
              }
            })}
          >
            <div hidden={section !== 'restaurante'} className={panelClass}>
              <Row label="Logotipo" hint="PNG, JPG ou WebP até 1 MB.">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
                    {restaurantLogo ? <img src={restaurantLogo} alt="Logotipo do restaurante" className="h-full w-full object-cover" /> : <span className="font-heading text-lg font-bold">V</span>}
                  </div>
                  <label className="inline-flex cursor-pointer items-center rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:text-slate-900">
                    Enviar logo
                    <input type="file" accept="image/*" className="hidden" onChange={(event) => {
                      const file = event.target.files?.[0]
                      if (file) {
                        uploadRestaurantLogo(file)
                      }
                      event.target.value = ''
                    }} />
                  </label>
                  {restaurantLogo ? <button type="button" className="text-sm font-medium text-rose-600 hover:text-rose-700" onClick={() => setRestaurantLogo('')}>Remover</button> : null}
                </div>
              </Row>
              <Row label="Cor da marca" hint="Colore o app do cliente (botões, destaques e tela inicial).">
                <div className="flex items-center gap-3">
                  <input type="color" value={brandColor} onChange={(event) => setBrandColor(event.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-slate-200 bg-white p-1" aria-label="Cor da marca" />
                  <span className="font-mono text-sm text-slate-600">{brandColor.toUpperCase()}</span>
                  {brandColor !== defaultBrandColor ? <button type="button" className="text-sm font-medium text-slate-600 hover:text-slate-900" onClick={() => setBrandColor(defaultBrandColor)}>Restaurar padrão</button> : null}
                </div>
              </Row>
              <Row label="Nome do restaurante">
                <Input {...register('restaurantName')} placeholder="Nome do restaurante" className={fieldClass} />
              </Row>
              <Row label="Telefone comercial">
                <Input {...register('phone')} placeholder="Telefone" className={fieldClass} />
              </Row>
              {!user?.isPlatformAdmin ? (
                <Row label="Link público" hint="Endereço do cardápio para seus clientes fazerem pedidos.">
                  <Input value={publicOrderUrl} readOnly aria-label="Link público do restaurante" className={cn(fieldClass, 'bg-slate-50 font-mono text-xs')} />
                  <div className="mt-2 flex gap-2">
                    <Button type="button" variant="outline" className={cn(outlineButtonClass, 'px-3 py-1.5')} onClick={() => void copyPublicOrderUrl()}>Copiar link</Button>
                    <Button type="button" variant="outline" className={cn(outlineButtonClass, 'px-3 py-1.5')} onClick={() => window.open(publicOrderUrl, '_blank', 'noopener,noreferrer')}>Abrir página</Button>
                  </div>
                </Row>
              ) : null}
              <Row label="Plano" hint="A troca de plano é feita em Ativação.">
                <p className="flex items-center gap-2 text-sm text-slate-800">
                  <span className={cn('h-2 w-2 rounded-full', tenant.status === 'active' ? 'bg-emerald-500' : 'bg-slate-300')} />
                  {planLabels[tenant.plan]} · {tenant.status === 'active' ? 'assinatura ativa' : 'assinatura inativa'}
                </p>
              </Row>
            </div>

            <div hidden={section !== 'horarios'} className={panelClass}>
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-4">
                <p className="text-sm text-slate-500">Dias e horários em que o restaurante recebe pedidos.</p>
                <button type="button" onClick={applyHoursToAll} className="shrink-0 text-sm font-medium text-orange-700 hover:text-orange-800">Aplicar a todos</button>
              </div>
              {businessHours.map((item, index) => (
                <div key={item.day} className="flex items-center gap-4 border-b border-slate-100 py-3 last:border-b-0">
                  <Toggle checked={item.enabled} onChange={(event) => updateBusinessHour(index, { enabled: event.target.checked })} aria-label={`${item.day}: ${item.enabled ? 'aberto' : 'fechado'}`} />
                  <p className={cn('w-28 shrink-0 text-sm font-medium', item.enabled ? 'text-slate-800' : 'text-slate-400')}>{item.day}</p>
                  {item.enabled ? (
                    <div className="flex items-center gap-2">
                      <Input value={item.openTime} onChange={(event) => updateBusinessHour(index, { openTime: event.target.value })} type="time" aria-label={`${item.day}: abre`} className={cn(fieldClass, 'h-9 w-28')} />
                      <span className="text-slate-300">–</span>
                      <Input value={item.closeTime} onChange={(event) => updateBusinessHour(index, { closeTime: event.target.value })} type="time" aria-label={`${item.day}: fecha`} className={cn(fieldClass, 'h-9 w-28')} />
                    </div>
                  ) : (
                    <span className="text-sm text-slate-400">Fechado</span>
                  )}
                </div>
              ))}
            </div>

            <div hidden={section !== 'entrega'} className={panelClass}>
              <GroupTitle>Taxa de entrega</GroupTitle>
              <Row label="Tipo de cobrança">
                <select value={deliverySettings.mode} onChange={(event) => updateDeliverySettings({ mode: event.target.value as DeliverySettings['mode'] })} className={selectClass}>
                  <option value="fixed">Taxa fixa</option>
                  <option value="perKm">Taxa por km</option>
                </select>
              </Row>
              {deliverySettings.mode === 'fixed' ? (
                <Row label="Taxa fixa" hint="Valor cobrado em toda entrega.">
                  <Input value={deliverySettings.fixedFee} onChange={(event) => updateDeliverySettings({ fixedFee: event.target.value })} placeholder="Ex: 8,00" inputMode="decimal" className={fieldClass} />
                </Row>
              ) : (
                <>
                  <Row label="Valor por km">
                    <Input value={deliverySettings.feePerKm} onChange={(event) => updateDeliverySettings({ feePerKm: event.target.value })} placeholder="Ex: 2,50" inputMode="decimal" className={fieldClass} />
                  </Row>
                  <Row label="CEP da pizzaria" hint="Ponto de partida para calcular a distância.">
                    <div className="flex gap-2">
                      <Input value={deliverySettings.originCep} onChange={(event) => updateDeliverySettings({ originCep: event.target.value })} placeholder="Ex: 01001-000" inputMode="numeric" className={fieldClass} />
                      <Button type="button" variant="outline" className={cn(outlineButtonClass, 'shrink-0')} onClick={validateOriginCep}>Verificar</Button>
                    </div>
                    {cepStatus ? <p className="mt-2 text-xs font-medium text-emerald-700">CEP válido: {cepStatus}</p> : null}
                  </Row>
                </>
              )}
              <GroupTitle>Pagamento</GroupTitle>
              {([['pix', 'Pix'], ['card', 'Cartão'], ['cash', 'Dinheiro']] as const).map(([field, label]) => (
                <Row key={field} label={label}>
                  <Toggle {...register(field)} aria-label={label} />
                </Row>
              ))}
              <GroupTitle>PDV</GroupTitle>
              <Row label="Interface compacta">
                <Toggle {...register('compactPos')} aria-label="Interface compacta" />
              </Row>
            </div>

            <div hidden={section !== 'mesas'} className={panelClass}>
              <Row label="Quantidade de mesas" hint="Ao aumentar, as novas mesas seguem a numeração. Ao diminuir, saem as últimas.">
                <div className="flex items-center gap-2">
                  <Button type="button" variant="outline" className={cn(outlineButtonClass, 'h-10 w-10 px-0')} onClick={() => setTableCount(tables.length - 1)} aria-label="Remover uma mesa">-</Button>
                  <Input value={tables.length} onChange={(event) => setTableCount(Number(event.target.value))} inputMode="numeric" aria-label="Quantidade de mesas" className={cn(fieldClass, 'w-20 text-center')} />
                  <Button type="button" variant="outline" className={cn(outlineButtonClass, 'h-10 w-10 px-0')} onClick={addTable} aria-label="Adicionar uma mesa">+</Button>
                </div>
              </Row>
              <GroupTitle>Nome de cada mesa</GroupTitle>
              <p className="pb-3 text-xs text-slate-500">Use número ou apelido, como "Varanda" ou "Balcão". É isso que aparece no PDV.</p>
              <div className="grid gap-2 pb-5 sm:grid-cols-2">
                {tables.map((name, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input value={name} onChange={(event) => updateTable(index, event.target.value)} maxLength={20} aria-label={`Nome da mesa ${index + 1}`} className={fieldClass} />
                    <button type="button" onClick={() => removeTable(index)} aria-label={`Remover mesa ${name}`} className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-orange-600"><X className="h-4 w-4" /></button>
                  </div>
                ))}
              </div>
              <div className="border-t border-slate-100 py-4">
                <Button type="button" variant="outline" className={outlineButtonClass} onClick={addTable}><Plus className="mr-1.5 h-4 w-4" />Adicionar mesa</Button>
              </div>
            </div>

            <div hidden={section !== 'aparencia'} className={panelClass}>
              <Row label="Tema" hint={themeDescriptions[selectedTheme]}>
                <select {...register('theme')} className={selectClass}>
                  {Object.keys(themeDescriptions).map((name) => <option key={name} value={name}>{name}</option>)}
                </select>
              </Row>
              <Row label="Densidade">
                <select {...register('density')} className={selectClass}>
                  <option value="comfortable">Confortável</option>
                  <option value="compact">Compacta</option>
                </select>
              </Row>
              <Row label="Cartões">
                <select {...register('cardStyle')} className={selectClass}>
                  <option value="soft">Suave com sombra</option>
                  <option value="glass">Vidro translúcido</option>
                  <option value="solid">Sólido e objetivo</option>
                </select>
              </Row>
            </div>
          </form>

          <div hidden={section !== 'equipe'} className={panelClass}>
            <div className="divide-y divide-slate-100">
              {users.length === 0 ? <p className="py-4 text-sm text-slate-500">Nenhum usuário carregado.</p> : null}
              {users.map((listedUser) => (
                <div key={listedUser.id} className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-medium text-slate-900">{listedUser.name}</p>
                    <p className="text-xs text-slate-500">{listedUser.username}{listedUser.email ? ` · ${listedUser.email}` : ''}</p>
                  </div>
                  <p className="text-xs text-slate-500">{listedUser.role} · {listedUser.shift}</p>
                </div>
              ))}
            </div>
            {canManageUsers ? (
              showUserForm ? (
                <form
                  onSubmit={usersForm.handleSubmit(async (values: UserFormValues) => {
                    try {
                      const result = await createUser(values)
                      setUsers((current) => [...current, result.user])
                      usersForm.reset()
                      setShowUserForm(false)
                      toast.success('Usuário criado com sucesso.')
                    } catch (error) {
                      toast.error(userErrorMessage(error, 'Não foi possível criar o usuário.'))
                    }
                  })}
                  className="border-t border-slate-200"
                >
                  <GroupTitle>Novo usuário</GroupTitle>
                  <Row label="Nome">
                    <Input {...usersForm.register('name')} placeholder="Nome do usuário" className={fieldClass} />
                  </Row>
                  <Row label="Usuário de login" hint="Letras minúsculas, sem espaços.">
                    <Input {...usersForm.register('username')} placeholder="ex.: maria.caixa" autoCapitalize="none" className={fieldClass} />
                    {usersForm.formState.errors.username ? <p className="mt-1 text-xs text-rose-600">{usersForm.formState.errors.username.message}</p> : null}
                  </Row>
                  <Row label="E-mail" hint="Opcional.">
                    <Input {...usersForm.register('email')} placeholder="E-mail" className={fieldClass} />
                  </Row>
                  <Row label="Turno">
                    <Input {...usersForm.register('shift')} placeholder="Turno" className={fieldClass} />
                  </Row>
                  <Row label="Função">
                    <select {...usersForm.register('roleKey')} className={selectClass}>
                      <option value="admin">Administrador</option>
                      <option value="manager">Gerente</option>
                      <option value="operator">Operador</option>
                    </select>
                  </Row>
                  <Row label="Senha inicial">
                    <PasswordInput {...usersForm.register('password')} placeholder="Mínimo de 6 caracteres" autoComplete="new-password" className={fieldClass} />
                  </Row>
                  <div className="flex gap-2 pb-5 pt-2">
                    <Button type="submit" className={primaryButtonClass}>Criar usuário</Button>
                    <Button type="button" variant="ghost" className="rounded-lg" onClick={() => { usersForm.reset(); setShowUserForm(false) }}>Cancelar</Button>
                  </div>
                </form>
              ) : (
                <div className="border-t border-slate-100 py-4">
                  <Button type="button" variant="outline" className={outlineButtonClass} onClick={() => setShowUserForm(true)}>Adicionar usuário</Button>
                </div>
              )
            ) : null}
          </div>

          <div hidden={section !== 'conta'} className={panelClass}>
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
            >
              <Row label="Senha atual">
                <PasswordInput {...passwordForm.register('currentPassword')} autoComplete="current-password" className={fieldClass} />
              </Row>
              <Row label="Nova senha" hint="Mínimo de 6 caracteres.">
                <PasswordInput {...passwordForm.register('nextPassword')} autoComplete="new-password" className={fieldClass} />
              </Row>
              <div className="pb-5 pt-2">
                <Button type="submit" variant="outline" className={outlineButtonClass}>Alterar senha</Button>
              </div>
            </form>
          </div>

          {dirty ? (
            <div className="sticky bottom-4 mt-4 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-sm text-slate-600">Você tem alterações não salvas.</p>
              <Button type="submit" form="settings-form" disabled={isSubmitting} className={primaryButtonClass}>Salvar</Button>
            </div>
          ) : null}
        </div>
      </div>
    </AdminLayout>
  )
}
