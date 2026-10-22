import { useEffect, useState, type FormEvent } from 'react'
import { AlertTriangle, ArrowLeft, ArrowUpRight, Building2, CheckCircle2, CircleDollarSign, Clock3, CreditCard, Eye, EyeOff, Info, KeyRound, LogIn, MessageCircle, Pencil, ReceiptText, Search, Trash2, TrendingUp, UserCog, UserPlus, Users, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { SaasLayout } from '@/components/layout/saas-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AccessChart } from '@/components/saas/access-chart'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { planLabels, type PlanKey } from '@/lib/plan-access'
import { createTenant, deleteTenant, fetchTenants, importLegacyTenants, needsLegacyImport, readLegacyTenants, tenantErrorMessage, updateTenant, type Tenant, type TenantStatus } from '@/lib/tenants-api'
import { createPlatformUser, createTenantAdminUser, deleteTenantAccess, fetchAllUsers, impersonateUser, platformPermissionLabels, updatePlatformUser, updatePlatformUserPermissions, updateTenantAccess, type AppUser } from '@/lib/users-api'
import { formatCurrency } from '@/lib/formatters'
import { addAuditLog, deleteLead, fetchAuditLogs, fetchLeads, fetchPlanConfigs, savePlanConfigs, updateLeadStatus, type Lead, type LeadStatus, type PlanConfig, type SaasAuditLog } from '@/lib/saas-api'
import { billingTypeLabels, fetchAdminBilling, subscriptionStatusLabels, type AdminSubscription, type BillingInvoice, type SubscriptionStatus } from '@/lib/billing-api'
import { usePolling } from '@/lib/use-polling'
import { useAuth } from '@/contexts/auth-context'
import { cn } from '@/lib/utils'
import { ActionMenu, Avatar, EmptyBlock, FilterPills, FormField, Pill, SearchBox, type PillTone } from '@/components/saas/saas-ui'
import { FeaturedStat, InvoiceTable, RevenueChart, SaasCard, StatTile, SubscriptionMix, type SubscriptionMixCounts } from '@/components/saas/dashboard-parts'
import { fetchAllTickets, updateTicket, type SupportTicket } from '@/lib/support-api'
import { businessTypeLabels, businessTypeOptions, type BusinessType } from '@/lib/business-types'
import { isValidOptionalEmail, isValidUsername, normalizeUsername, userErrorMessage, usernameHint } from '@/lib/username'

const planOrder: PlanKey[] = ['Free', 'Start', 'Pro', 'Premium']

const subscriptionTones: Record<SubscriptionStatus, PillTone> = { none: 'neutral', trialing: 'info', active: 'ok', past_due: 'bad', cancelled: 'neutral' }

function SubscriptionBadge({ subscription }: { subscription?: AdminSubscription }) {
  return <Pill tone={subscriptionTones[subscription?.status ?? 'none']}>{subscription ? subscriptionStatusLabels[subscription.status].label : 'Sem cobrança'}</Pill>
}

/** Uma situação só por cliente: junta o cadastro (suspenso), a cobrança e o acesso. */
function clientSituation(tenant: Tenant, subscription?: AdminSubscription): { label: string; tone: PillTone; hint: string } {
  if (tenant.status === 'inactive') return { label: 'Suspenso', tone: 'neutral', hint: 'Acesso suspenso manualmente pelo painel.' }
  if (!subscription || subscription.status === 'none') {
    return tenant.plan === 'Free'
      ? { label: 'Free', tone: 'neutral', hint: 'Plano gratuito, sem cobrança.' }
      : { label: 'Cortesia', tone: 'warn', hint: 'Plano pago liberado sem cobrança no Asaas.' }
  }
  if (subscription.status === 'cancelled') return { label: 'Cancelado', tone: 'neutral', hint: 'A assinatura foi cancelada.' }
  if (subscription.access === 'restricted') {
    return subscription.status === 'trialing'
      ? { label: 'Teste vencido', tone: 'bad', hint: 'O teste grátis acabou e o painel do lojista está bloqueado.' }
      : { label: 'Bloqueado', tone: 'bad', hint: 'Mensalidade em atraso além da carência: o painel do lojista está bloqueado.' }
  }
  if (subscription.status === 'trialing') return { label: 'Em teste', tone: 'info', hint: 'Teste grátis em andamento.' }
  if (subscription.status === 'past_due') return { label: 'Em atraso', tone: 'bad', hint: 'Mensalidade em atraso, ainda dentro da carência.' }
  return subscription.plan === tenant.plan
    ? { label: 'Ativo', tone: 'ok', hint: 'Assinatura em dia.' }
    : { label: 'Ativo', tone: 'ok', hint: `Assinatura em dia, cobrada como ${subscription.plan}.` }
}

function SituationBadge({ tenant, subscription }: { tenant: Tenant; subscription?: AdminSubscription }) {
  const situation = clientSituation(tenant, subscription)
  return <span title={situation.hint}><Pill tone={situation.tone}>{situation.label}</Pill></span>
}

function PasswordInput({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="relative">
      <Input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={visible ? 'text' : 'password'} autoComplete="new-password" className="pr-12" />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  )
}

export function ActivationPage() {
  const navigate = useNavigate()
  const { view, tenantId } = useParams()
  const currentView = tenantId ? 'cliente-detalhe' : view
  const [tenants, setTenants] = useState<Tenant[]>([])
  const [users, setUsers] = useState<AppUser[]>([])
  const [planConfigs, setPlanConfigs] = useState<PlanConfig[]>([])
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>([])
  const [subscriptions, setSubscriptions] = useState<AdminSubscription[]>([])
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'open' | 'overdue' | 'paid' | 'cancelled'>('all')
  const [invoiceQuery, setInvoiceQuery] = useState('')
  const [clientQuery, setClientQuery] = useState('')
  const [accessQuery, setAccessQuery] = useState('')
  const [ticketFilter, setTicketFilter] = useState<'all' | SupportTicket['status']>('all')
  const { user: currentUser } = useAuth()
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>([])
  const [auditLogs, setAuditLogs] = useState<SaasAuditLog[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [restaurantName, setRestaurantName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [adminUsername, setAdminUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [businessType, setBusinessType] = useState<BusinessType>('pizzeria')
  const [plan, setPlan] = useState<PlanKey>('Pro')
  const [password, setPassword] = useState('')
  const [clientFilter, setClientFilter] = useState<'all' | PlanKey | TenantStatus>('all')
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [platformUserName, setPlatformUserName] = useState('')
  const [platformUserUsername, setPlatformUserUsername] = useState('')
  const [platformUserEmail, setPlatformUserEmail] = useState('')
  const [platformUserPassword, setPlatformUserPassword] = useState('')
  const [editingPlatformUserId, setEditingPlatformUserId] = useState<number | null>(null)
  const [editingPlatformUserName, setEditingPlatformUserName] = useState('')
  const [editingPlatformUserUsername, setEditingPlatformUserUsername] = useState('')
  const [editingPlatformUserEmail, setEditingPlatformUserEmail] = useState('')
  const [editingPlatformUserPassword, setEditingPlatformUserPassword] = useState('')
  const [editingAccessId, setEditingAccessId] = useState<number | null>(null)
  const [editingAccessName, setEditingAccessName] = useState('')
  const [editingAccessUsername, setEditingAccessUsername] = useState('')
  const [editingAccessEmail, setEditingAccessEmail] = useState('')
  const [editingAccessRole, setEditingAccessRole] = useState('operator')
  const [editingAccessShift, setEditingAccessShift] = useState('')
  const [editingAccessPassword, setEditingAccessPassword] = useState('')
  const [editingAccessPasswordConfirm, setEditingAccessPasswordConfirm] = useState('')
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null)
  const [editingRestaurantName, setEditingRestaurantName] = useState('')
  const [editingOwnerName, setEditingOwnerName] = useState('')
  const [editingTenantEmail, setEditingTenantEmail] = useState('')
  const [editingTenantPhone, setEditingTenantPhone] = useState('')
  const [editingTenantCity, setEditingTenantCity] = useState('')

  useEffect(() => {
    void fetchAllUsers().then((result) => setUsers(result.users))
  }, [tenants])

  const clientTenants = tenants
  const filteredClientTenants = clientTenants.filter((tenant) => clientFilter === 'all' || tenant.plan === clientFilter || tenant.status === clientFilter)
  const activeTenants = clientTenants.filter((tenant) => tenant.status === 'active')
  const inactiveTenants = clientTenants.filter((tenant) => tenant.status === 'inactive')
  const planPrices = planConfigs.reduce<Partial<Record<PlanKey, number>>>((prices, config) => ({ ...prices, [config.key]: config.price }), {})
  const recurringSubscriptions = subscriptions.filter((item) => (item.status === 'active' || item.status === 'past_due') && item.price > 0)
  const monthlyRecurringRevenue = recurringSubscriptions.reduce((sum, item) => sum + item.price, 0)
  const averageTicket = recurringSubscriptions.length ? monthlyRecurringRevenue / recurringSubscriptions.length : 0
  const trialCount = subscriptions.filter((item) => item.status === 'trialing').length
  const activeUsers = users.filter((user) => clientTenants.some((tenant) => tenant.id === user.restaurantId))
  const platformUsers = users.filter((user) => user.isPlatformAdmin)
  const usersByTenant = new Map(clientTenants.map((tenant) => [tenant.id, activeUsers.filter((user) => user.restaurantId === tenant.id)]))
  const selectedTenant = tenantId ? clientTenants.find((tenant) => tenant.id === tenantId) : undefined
  const selectedTenantUsers = selectedTenant ? usersByTenant.get(selectedTenant.id) ?? [] : []
  const selectedTenantInvoices = selectedTenant ? billingInvoices.filter((invoice) => invoice.tenantId === selectedTenant.id) : []
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const subscriptionByTenant = new Map(subscriptions.map((item) => [item.tenantId, item]))
  const paidThisMonth = billingInvoices.filter((invoice) => invoice.status === 'paid' && invoice.paidAt?.slice(0, 7) === currentMonth)
  const sumInvoices = (items: BillingInvoice[]) => items.reduce((sum, invoice) => sum + invoice.amount, 0)
  const paidRevenue = sumInvoices(paidThisMonth)
  const openRevenue = sumInvoices(billingInvoices.filter((invoice) => invoice.status === 'open'))
  const overdueRevenue = sumInvoices(billingInvoices.filter((invoice) => invoice.status === 'overdue'))
  const previousMonthDate = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1)
  const previousMonth = `${previousMonthDate.getFullYear()}-${String(previousMonthDate.getMonth() + 1).padStart(2, '0')}`
  const paidLastMonth = sumInvoices(billingInvoices.filter((invoice) => invoice.status === 'paid' && invoice.paidAt?.slice(0, 7) === previousMonth))
  const revenueDelta = paidLastMonth > 0 ? Math.round((paidRevenue - paidLastMonth) / paidLastMonth * 100) : null
  const monthName = new Date().toLocaleDateString('pt-BR', { month: 'long' })
  const mixCounts: SubscriptionMixCounts = { active: 0, trialing: 0, past_due: 0, cancelled: 0, none: 0 }
  for (const tenant of clientTenants) {
    const status = subscriptionByTenant.get(tenant.id)?.status ?? 'none'
    mixCounts[status] += 1
  }
  const describeInvoice = (tenantId: string) => ({
    name: clientTenants.find((item) => item.id === tenantId)?.restaurantName ?? subscriptionByTenant.get(tenantId)?.customerName ?? tenantId,
    plan: subscriptionByTenant.get(tenantId)?.plan,
  })
  const visibleInvoices = billingInvoices.filter((invoice) => {
    const matchesStatus = invoiceFilter === 'all' || invoice.status === invoiceFilter || (invoiceFilter === 'cancelled' && invoice.status === 'refunded')
    const query = invoiceQuery.trim().toLowerCase()
    return matchesStatus && (!query || describeInvoice(invoice.tenantId).name.toLowerCase().includes(query))
  })
  const invoiceFilters: { value: typeof invoiceFilter; label: string }[] = [
    { value: 'all', label: 'Todas' }, { value: 'open', label: 'Em aberto' }, { value: 'overdue', label: 'Em atraso' }, { value: 'paid', label: 'Pagas' }, { value: 'cancelled', label: 'Canceladas' },
  ]
  const clientQueryText = clientQuery.trim().toLowerCase()
  const searchedClientTenants = filteredClientTenants.filter((tenant) => !clientQueryText || [tenant.restaurantName, tenant.ownerName, tenant.email, tenant.city].some((value) => value.toLowerCase().includes(clientQueryText)))
  const accessQueryText = accessQuery.trim().toLowerCase()
  const tenantNameFor = (tenantId?: string) => clientTenants.find((item) => item.id === tenantId)?.restaurantName ?? ''
  const searchedUsers = activeUsers.filter((user) => !accessQueryText || [user.name, user.username, user.email ?? '', tenantNameFor(user.restaurantId)].some((value) => value.toLowerCase().includes(accessQueryText)))
  const selectedSubscription = selectedTenant ? subscriptionByTenant.get(selectedTenant.id) : undefined
  const openClient = (tenantId: string) => {
    if (clientTenants.some((item) => item.id === tenantId)) navigate(`/saas/clientes/${tenantId}`)
  }
  const billableRevenue = paidRevenue + openRevenue + overdueRevenue
  const collectionRate = billableRevenue ? Math.round(paidRevenue / billableRevenue * 100) : 0

  const loadBilling = () => fetchAdminBilling()
    .then((result) => {
      setSubscriptions(result.subscriptions)
      setBillingInvoices(result.invoices)
    })
    .catch(() => undefined)

  const loadTickets = () => fetchAllTickets().then(setSupportTickets).catch(() => undefined)

  const loadTenants = async () => {
    try {
      // Primeira abertura nesta máquina: leva ao servidor os clientes que só existiam no navegador.
      if (needsLegacyImport()) await importLegacyTenants(readLegacyTenants())
      setTenants(await fetchTenants())
    } catch {
      toast.error('Não foi possível carregar os clientes.')
    }
  }

  const loadLeads = () => fetchLeads().then(setLeads).catch(() => undefined)
  const loadAudit = () => fetchAuditLogs().then(setAuditLogs).catch(() => undefined)

  const refreshData = () => {
    void loadTenants()
    void fetchAllUsers().then((result) => setUsers(result.users))
    void loadBilling()
    void loadTickets()
    void loadLeads()
    void loadAudit()
  }

  useEffect(() => {
    void fetchPlanConfigs().then(setPlanConfigs).catch(() => undefined)
    void loadTenants()
    void loadBilling()
    void loadTickets()
    void loadLeads()
    void loadAudit()
  }, [])

  usePolling(loadBilling, 60_000)
  usePolling(loadTickets, 30_000)
  usePolling(loadLeads, 60_000)

  const logAction = (action: string, target: string) => {
    void addAuditLog(action, target).then(loadAudit).catch(() => undefined)
  }

  const createClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedRestaurantName = restaurantName.trim()
    const trimmedOwnerName = ownerName.trim()
    const trimmedUsername = normalizeUsername(adminUsername)
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPhone = phone.trim()
    const trimmedCity = city.trim()

    if (!trimmedRestaurantName || !trimmedOwnerName || !trimmedEmail || !trimmedPhone || !trimmedCity || password.length < 8) {
      toast.error('Preencha cliente, responsável, contato, cidade e senha com 8 caracteres ou mais.')
      return
    }
    if (!isValidUsername(trimmedUsername)) {
      toast.error(`Usuário do admin inválido. Use ${usernameHint}`)
      return
    }

    let tenant: Tenant | undefined
    try {
      tenant = await createTenant({
        restaurantName: trimmedRestaurantName,
        ownerName: trimmedOwnerName,
        email: trimmedEmail,
        phone: trimmedPhone,
        city: trimmedCity,
        businessType,
        plan,
        status: 'active',
      })

      await createTenantAdminUser({ tenantId: tenant.id, name: trimmedOwnerName, username: trimmedUsername, email: trimmedEmail, password, businessType })
      logAction('Cliente ativado', `${tenant.restaurantName} · ${planLabels[tenant.plan]}`)
      refreshData()
      setRestaurantName('')
      setOwnerName('')
      setAdminUsername('')
      setEmail('')
      setPhone('')
      setCity('')
      setBusinessType('pizzeria')
      setPlan('Pro')
      setPassword('')
      toast.success('Cliente ativado e usuário administrador criado.')
    } catch (error) {
      if (tenant) await deleteTenant(tenant.id).catch(() => undefined)
      toast.error(tenantErrorMessage(error, userErrorMessage(error, 'Não foi possível ativar o cliente.')))
    }
  }

  const updateClient = async (tenant: Tenant, values: { plan?: PlanKey; status?: TenantStatus }) => {
    try {
      await updateTenant(tenant.id, values)
      refreshData()
      logAction(values.plan ? 'Plano alterado' : 'Status alterado', `${tenant.restaurantName} · ${values.plan ? planLabels[values.plan] : values.status}`)
      toast.success(values.plan ? 'Plano alterado. A cobrança acompanha o novo plano.' : 'Cliente atualizado.')
    } catch (error) {
      toast.error(tenantErrorMessage(error, 'Não foi possível atualizar o cliente.'))
    }
  }

  const accessClient = async (tenant: Tenant) => {
    const adminUser = users.find((user) => user.restaurantId === tenant.id && user.roleKey === 'admin')
    if (!adminUser) {
      toast.error('Este cliente ainda não possui administrador.')
      return
    }

    await impersonateUser(adminUser.id)
    logAction('Acesso como cliente', tenant.restaurantName)
    navigate('/dashboard', { replace: true })
  }

  const updatePlanConfig = (key: PlanKey, values: Partial<PlanConfig>) => {
    const nextConfigs = planConfigs.map((config) => config.key === key ? { ...config, ...values } : config)
    setPlanConfigs(nextConfigs)
  }

  const savePlansConfiguration = async () => {
    try {
      setPlanConfigs(await savePlanConfigs(planConfigs))
    } catch {
      toast.error('Não foi possível salvar os planos.')
      return
    }
    logAction('Planos configurados', 'Tabela de planos')
    toast.success('Planos salvos e publicados na landing page.')
  }

  const togglePlatformPermission = async (user: AppUser, permission: string) => {
    const permissions = user.permissions.includes(permission) ? user.permissions.filter((item) => item !== permission) : [...user.permissions, permission]
    const result = await updatePlatformUserPermissions(user.id, permissions)
    setUsers(result.users)
    logAction('Permissões atualizadas', user.username)
    toast.success('Permissões atualizadas.')
  }

  const saveTicket = async (ticket: SupportTicket, values: Partial<Pick<SupportTicket, 'status' | 'priority' | 'reply'>>) => {
    try {
      const saved = await updateTicket(ticket.id, values)
      setSupportTickets((current) => current.map((item) => item.id === saved.id ? saved : item))
      setReplyDrafts(({ [ticket.id]: _discarded, ...rest }) => rest)
      logAction('Ticket atualizado', ticket.subject)
      toast.success('Ticket atualizado.')
    } catch {
      toast.error('Não foi possível atualizar o ticket.')
    }
  }

  const exportClients = () => {
    const rows = ['Restaurante,Responsavel,Email,Cidade,Segmento,Plano,Status', ...filteredClientTenants.map((tenant) => `${tenant.restaurantName},${tenant.ownerName},${tenant.email},${tenant.city},${businessTypeLabels[tenant.businessType]},${tenant.plan},${tenant.status}`)]
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'clientes-vaija.csv'
    link.click()
    URL.revokeObjectURL(url)
  }

  const createSaasUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const username = normalizeUsername(platformUserUsername)
    if (!platformUserName.trim() || !isValidUsername(username) || !isValidOptionalEmail(platformUserEmail) || platformUserPassword.length < 8) {
      toast.error(`Informe nome, usuário (${usernameHint}) e senha com 8 caracteres ou mais. O e-mail é opcional.`)
      return
    }

    try {
      await createPlatformUser({ name: platformUserName, username, email: platformUserEmail, password: platformUserPassword })
      setPlatformUserName('')
      setPlatformUserUsername('')
      setPlatformUserEmail('')
      setPlatformUserPassword('')
      refreshData()
      logAction('Usuário SaaS criado', username)
      toast.success('Usuário interno do SaaS criado.')
    } catch (error) {
      toast.error(userErrorMessage(error, 'Não foi possível criar o usuário SaaS.'))
    }
  }

  const startEditingPlatformUser = (user: AppUser) => {
    setEditingPlatformUserId(user.id)
    setEditingPlatformUserName(user.name)
    setEditingPlatformUserUsername(user.username)
    setEditingPlatformUserEmail(user.email ?? '')
    setEditingPlatformUserPassword('')
  }

  const cancelEditingPlatformUser = () => {
    setEditingPlatformUserId(null)
    setEditingPlatformUserName('')
    setEditingPlatformUserUsername('')
    setEditingPlatformUserEmail('')
    setEditingPlatformUserPassword('')
  }

  const savePlatformUser = async (event: FormEvent<HTMLFormElement>, user: AppUser) => {
    event.preventDefault()
    const updatedUsername = normalizeUsername(editingPlatformUserUsername)
    if (!editingPlatformUserName.trim() || !isValidUsername(updatedUsername) || !isValidOptionalEmail(editingPlatformUserEmail) || (editingPlatformUserPassword && editingPlatformUserPassword.length < 8)) {
      toast.error(`Informe nome e usuário (${usernameHint}). A nova senha deve ter pelo menos 8 caracteres.`)
      return
    }

    try {
      await updatePlatformUser(user.id, {
        name: editingPlatformUserName,
        username: updatedUsername,
        email: editingPlatformUserEmail.trim().toLowerCase(),
        password: editingPlatformUserPassword || undefined,
        permissions: user.permissions,
      })
      cancelEditingPlatformUser()
      refreshData()
      logAction('Usuário SaaS atualizado', updatedUsername)
      toast.success('Usuário SaaS atualizado.')
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const errorMessages: Record<string, string> = {
        username_already_exists: 'Já existe um usuário com esse nome de login.',
        invalid_platform_user: 'Confira nome, usuário, e-mail, permissões e use uma senha com pelo menos 8 caracteres.',
        user_not_found: 'O usuário SaaS não foi encontrado no banco de dados.',
        forbidden: 'Sua sessão não tem permissão para alterar este usuário.',
      }
      toast.error(errorMessages[message] ?? 'Não foi possível gravar as alterações no banco de dados.')
    }
  }

  const startEditingAccess = (user: AppUser) => {
    setEditingAccessId(user.id)
    setEditingAccessName(user.name)
    setEditingAccessUsername(user.username)
    setEditingAccessEmail(user.email ?? '')
    setEditingAccessRole(user.roleKey)
    setEditingAccessShift(user.shift)
    setEditingAccessPassword('')
    setEditingAccessPasswordConfirm('')
  }

  const cancelEditingAccess = () => {
    setEditingAccessId(null)
    setEditingAccessName('')
    setEditingAccessUsername('')
    setEditingAccessEmail('')
    setEditingAccessRole('operator')
    setEditingAccessShift('')
    setEditingAccessPassword('')
    setEditingAccessPasswordConfirm('')
  }

  const saveAccess = async (event: FormEvent<HTMLFormElement>, user: AppUser) => {
    event.preventDefault()
    const updatedUsername = normalizeUsername(editingAccessUsername)
    if (editingAccessPassword !== editingAccessPasswordConfirm) {
      toast.error('A confirmação da senha não confere.')
      return
    }
    if (!editingAccessName.trim() || !isValidUsername(updatedUsername) || !isValidOptionalEmail(editingAccessEmail) || !editingAccessShift.trim() || (editingAccessPassword && editingAccessPassword.length < 8)) {
      toast.error(`Preencha nome, usuário (${usernameHint}) e turno. A nova senha deve ter pelo menos 8 caracteres.`)
      return
    }
    try {
      await updateTenantAccess(user.id, {
        name: editingAccessName,
        username: updatedUsername,
        email: editingAccessEmail.trim().toLowerCase(),
        roleKey: editingAccessRole,
        shift: editingAccessShift,
        password: editingAccessPassword || undefined,
      })
      cancelEditingAccess()
      refreshData()
      logAction('Acesso atualizado', updatedUsername)
      toast.success('Acesso atualizado.')
    } catch (error) {
      toast.error(userErrorMessage(error, 'Não foi possível atualizar o acesso.'))
    }
  }

  const removeAccess = async (user: AppUser) => {
    try {
      await deleteTenantAccess(user.id)
      if (editingAccessId === user.id) cancelEditingAccess()
      refreshData()
      logAction('Acesso excluído', user.username)
      toast.success('Acesso excluído.')
    } catch {
      toast.error('Não foi possível excluir o acesso.')
    }
  }

  const startEditingTenant = (tenant: Tenant) => {
    setEditingTenantId(tenant.id)
    setEditingRestaurantName(tenant.restaurantName)
    setEditingOwnerName(tenant.ownerName)
    setEditingTenantEmail(tenant.email)
    setEditingTenantPhone(tenant.phone)
    setEditingTenantCity(tenant.city)
  }

  const cancelEditingTenant = () => {
    setEditingTenantId(null)
    setEditingRestaurantName('')
    setEditingOwnerName('')
    setEditingTenantEmail('')
    setEditingTenantPhone('')
    setEditingTenantCity('')
  }

  const saveTenant = async (event: FormEvent<HTMLFormElement>, tenant: Tenant) => {
    event.preventDefault()
    if (!editingRestaurantName.trim() || !editingOwnerName.trim() || !editingTenantEmail.trim() || !editingTenantPhone.trim() || !editingTenantCity.trim()) {
      toast.error('Preencha restaurante, responsável, e-mail, telefone e cidade.')
      return
    }
    const updatedRestaurantName = editingRestaurantName.trim()
    try {
      await updateTenant(tenant.id, {
        restaurantName: updatedRestaurantName,
        ownerName: editingOwnerName.trim(),
        email: editingTenantEmail.trim().toLowerCase(),
        phone: editingTenantPhone.trim(),
        city: editingTenantCity.trim(),
      })
    } catch (error) {
      toast.error(tenantErrorMessage(error, 'Não foi possível salvar o cliente.'))
      return
    }
    cancelEditingTenant()
    refreshData()
    logAction('Cliente atualizado', updatedRestaurantName)
    toast.success('Cliente atualizado.')
  }

  const removeTenant = async (tenant: Tenant, tenantUsers: AppUser[]) => {
    try {
      // O servidor cancela a cobrança no Asaas antes de excluir; se falhar, nada é removido.
      await deleteTenant(tenant.id)
    } catch (error) {
      toast.error(tenantErrorMessage(error, 'Não foi possível excluir o cliente.'))
      return
    }
    await Promise.allSettled(tenantUsers.map((user) => deleteTenantAccess(user.id)))
    if (editingTenantId === tenant.id) cancelEditingTenant()
    refreshData()
    logAction('Cliente excluído', tenant.restaurantName)
    toast.success('Cliente e acessos vinculados excluídos.')
  }

  const summaryCards = (
    <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
      <StatTile label="Clientes ativos" value={String(activeTenants.length)} detail={`${inactiveTenants.length} inativo(s)`} icon={<Building2 className="h-[18px] w-[18px]" />} />
      <StatTile label="MRR" value={formatCurrency(monthlyRecurringRevenue)} detail={`${recurringSubscriptions.length} assinatura(s) paga(s)`} icon={<TrendingUp className="h-[18px] w-[18px]" />} tone="ok" />
      <StatTile label="Acessos criados" value={String(activeUsers.length)} detail="Usuários de clientes" icon={<KeyRound className="h-[18px] w-[18px]" />} tone="info" />
      <StatTile label="Ticket médio" value={formatCurrency(averageTicket)} detail="Por assinatura paga" icon={<CreditCard className="h-[18px] w-[18px]" />} tone="warn" />
    </div>
  )

  const clientGrid = 'lg:grid-cols-[minmax(200px,2fr)_150px_120px_72px_auto]'
  const clientsSection = (
    <SaasCard>
      <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <FilterPills<'all' | TenantStatus> value={clientFilter} onChange={setClientFilter} options={[{ value: 'all', label: 'Todos' }, { value: 'active', label: 'Ativos' }, { value: 'inactive', label: 'Inativos' }]} />
          <select value={planOrder.includes(clientFilter as PlanKey) ? clientFilter : ''} onChange={(event) => setClientFilter((event.target.value || 'all') as 'all' | PlanKey)} aria-label="Filtrar por plano" className="h-9 rounded-full border px-3 text-xs font-semibold outline-none">
            <option value="">Todos os planos</option>
            {planOrder.map((item) => <option key={item} value={item}>{planLabels[item]}</option>)}
          </select>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <SearchBox value={clientQuery} onChange={setClientQuery} placeholder="Buscar cliente" />
          <Button type="button" variant="outline" className="h-10 py-0" onClick={exportClients}>Exportar CSV</Button>
        </div>
      </div>
      <p className="mb-3 text-sm text-sa-muted">{searchedClientTenants.length} cliente(s) encontrado(s)</p>
      {searchedClientTenants.length === 0 ? <EmptyBlock icon={<Building2 className="h-5 w-5" />} text="Nenhum cliente com esse filtro." /> : (
        <div className="overflow-hidden rounded-xl border border-sa-border">
          <div className={cn('hidden gap-4 border-b border-sa-border bg-sa-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-sa-soft lg:grid', clientGrid)}>
            <span>Cliente</span><span>Plano</span><span>Situação</span><span>Acessos</span><span className="w-[148px]" />
          </div>
          <ul className="divide-y divide-sa-border">
            {searchedClientTenants.map((tenant) => {
              const tenantUsers = usersByTenant.get(tenant.id) ?? []
              return (
                <li key={tenant.id} className="px-4 py-4 transition-colors hover:bg-sa-hover">
                  {editingTenantId === tenant.id ? (
                    <form onSubmit={(event) => saveTenant(event, tenant)} className="grid gap-3 md:grid-cols-2">
                      <Input value={editingRestaurantName} onChange={(event) => setEditingRestaurantName(event.target.value)} placeholder="Nome do restaurante" />
                      <Input value={editingOwnerName} onChange={(event) => setEditingOwnerName(event.target.value)} placeholder="Responsável" />
                      <Input value={editingTenantEmail} onChange={(event) => setEditingTenantEmail(event.target.value)} placeholder="E-mail" type="email" />
                      <Input value={editingTenantPhone} onChange={(event) => setEditingTenantPhone(event.target.value)} placeholder="Telefone" />
                      <Input value={editingTenantCity} onChange={(event) => setEditingTenantCity(event.target.value)} placeholder="Cidade/UF" className="md:col-span-2" />
                      <div className="flex gap-2 md:col-span-2">
                        <Button type="submit">Salvar alterações</Button>
                        <Button type="button" variant="outline" onClick={cancelEditingTenant}>Cancelar</Button>
                      </div>
                    </form>
                  ) : (
                    <div className={cn('grid gap-3 lg:items-center lg:gap-4', clientGrid)}>
                      <div className="flex min-w-0 items-center gap-3">
                        <Avatar name={tenant.restaurantName} />
                        <div className="min-w-0">
                          <button type="button" onClick={() => navigate(`/saas/clientes/${tenant.id}`)} className="block max-w-full truncate text-left text-sm font-semibold text-sa-text hover:text-sa-accent-text">{tenant.restaurantName}</button>
                          <p className="truncate text-xs text-sa-muted">{tenant.ownerName} · {tenant.email}</p>
                          <p className="truncate text-xs text-sa-soft">{tenant.city}</p>
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Pill tone="accent">{tenant.plan}</Pill>
                        {subscriptionByTenant.get(tenant.id)?.plan && subscriptionByTenant.get(tenant.id)?.plan !== tenant.plan ? <span title="O plano cobrado no Asaas é diferente do plano liberado."><Pill tone="warn">Cobrado: {subscriptionByTenant.get(tenant.id)?.plan}</Pill></span> : null}
                      </div>
                      <SituationBadge tenant={tenant} subscription={subscriptionByTenant.get(tenant.id)} />
                      <p className="text-sm text-sa-text-2"><span className="mr-1 text-xs text-sa-soft lg:hidden">Acessos</span>{tenantUsers.length}</p>
                      <div className="flex items-center gap-1 lg:justify-end">
                        <Button type="button" variant="outline" className="h-9 px-3 py-0 text-xs" onClick={() => navigate(`/saas/clientes/${tenant.id}`)}>Ver detalhe</Button>
                        <ActionMenu
                          label={`Mais ações para ${tenant.restaurantName}`}
                          items={[
                            { label: 'Acessar como cliente', icon: <LogIn className="h-4 w-4" />, onClick: () => accessClient(tenant) },
                            { label: 'Editar dados', icon: <Pencil className="h-4 w-4" />, onClick: () => startEditingTenant(tenant) },
                            { label: tenant.status === 'active' ? 'Suspender acesso' : 'Reativar acesso', icon: tenant.status === 'active' ? <X className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />, onClick: () => updateClient(tenant, { status: tenant.status === 'active' ? 'inactive' : 'active' }) },
                          ]}
                        />
                        <ConfirmDialog
                          trigger={<button type="button" aria-label={`Excluir ${tenant.restaurantName}`} title="Excluir cliente" className="flex h-9 w-9 items-center justify-center rounded-lg text-sa-bad transition-colors hover:bg-sa-bad-soft"><Trash2 className="h-4 w-4" /></button>}
                          title="Excluir cliente?"
                          description={`O restaurante ${tenant.restaurantName}, seus acessos e cobranças serão removidos. Esta ação não pode ser desfeita.`}
                          confirmLabel="Excluir cliente"
                          onConfirm={() => { void removeTenant(tenant, tenantUsers) }}
                        />
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </SaasCard>
  )

  const activationForm = (
    <form onSubmit={createClient}>
      <SaasCard title="Novo cliente" description="O acesso e as categorias iniciais são configurados para o nicho escolhido.">
        <div className="grid gap-3">
          <Input value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} placeholder="Nome do restaurante" />
          <Input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Responsável" />
          <Input value={adminUsername} onChange={(event) => setAdminUsername(event.target.value)} placeholder="Usuário de login do admin (ex.: pizzaria.admin)" autoCapitalize="none" />
          <div className="grid gap-3 sm:grid-cols-2">
            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail de contato" type="email" />
            <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="WhatsApp" inputMode="tel" />
          </div>
          <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cidade/UF" />
          <FormField label="Nicho do negócio" hint={businessTypeOptions.find((option) => option.value === businessType)?.description}>
            <select value={businessType} onChange={(event) => setBusinessType(event.target.value as BusinessType)} className="h-11 w-full border px-4 text-sm outline-none">
              {businessTypeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </FormField>
          <FormField label="Plano">
            <select value={plan} onChange={(event) => setPlan(event.target.value as PlanKey)} className="h-11 w-full border px-4 text-sm outline-none">
              {planOrder.map((item) => <option key={item} value={item}>{planPrices[item] === undefined ? planLabels[item] : `${planLabels[item]} · ${formatCurrency(planPrices[item])}/mês`}</option>)}
            </select>
          </FormField>
          <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha inicial" type="password" />
        </div>
        <Button type="submit" className="mt-5 w-full"><CheckCircle2 className="mr-2 h-4 w-4" />Ativar plano e criar acesso</Button>
      </SaasCard>
    </form>
  )

  const clientDetailSection = selectedTenant ? (
    <div className="space-y-6">
      <button type="button" onClick={() => navigate('/saas/clientes')} className="inline-flex items-center gap-1.5 text-sm font-semibold text-sa-muted transition-colors hover:text-sa-accent-text"><ArrowLeft className="h-4 w-4" />Voltar para clientes</button>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <SaasCard>
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex min-w-0 items-center gap-4">
                <Avatar name={selectedTenant.restaurantName} size="lg" />
                <div className="min-w-0">
                  <h2 className="font-heading text-2xl font-bold text-sa-text">{selectedTenant.restaurantName}</h2>
                  <p className="mt-1 text-sm text-sa-muted">{selectedTenant.ownerName} · {selectedTenant.email}</p>
                  <p className="text-sm text-sa-muted">{selectedTenant.city} · {selectedTenant.phone}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="accent">{planLabels[selectedTenant.plan]}</Pill>
                <Pill>{businessTypeLabels[selectedTenant.businessType]}</Pill>
                <SituationBadge tenant={selectedTenant} subscription={selectedSubscription} />
              </div>
            </div>
            <div className="mt-6 grid items-start gap-3 border-t border-sa-border pt-5 md:grid-cols-2">
              <FormField label="Plano" hint={selectedSubscription && selectedSubscription.status !== 'none' && selectedSubscription.status !== 'cancelled' && selectedSubscription.plan !== 'Free' ? 'Este cliente tem cobrança ativa: trocar o plano atualiza o valor no Asaas.' : 'Sem cobrança ativa: a troca libera o plano como cortesia, sem cobrar.'}>
                <select value={selectedTenant.plan} onChange={(event) => updateClient(selectedTenant, { plan: event.target.value as PlanKey })} className="h-11 w-full border px-4 text-sm outline-none">
                  {planOrder.map((item) => <option key={item} value={item}>{planLabels[item]}</option>)}
                </select>
              </FormField>
              <FormField label="Situação do cadastro">
                <select value={selectedTenant.status} onChange={(event) => updateClient(selectedTenant, { status: event.target.value as TenantStatus })} className="h-11 w-full border px-4 text-sm outline-none">
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </FormField>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button type="button" variant="outline" onClick={() => accessClient(selectedTenant)}><LogIn className="mr-2 h-4 w-4" />Acessar como cliente</Button>
              <Button type="button" variant="outline" onClick={() => updateClient(selectedTenant, { status: selectedTenant.status === 'active' ? 'inactive' : 'active' })}>{selectedTenant.status === 'active' ? 'Suspender acesso' : 'Reativar acesso'}</Button>
            </div>
          </SaasCard>

          <SaasCard title="Cobranças" description={`${selectedTenantInvoices.length} registro(s)`}>
            <InvoiceTable invoices={selectedTenantInvoices} describe={describeInvoice} emptyText="Este cliente ainda não tem cobranças." />
          </SaasCard>
        </div>

        <div className="space-y-6">
          <SaasCard title="Assinatura">
            <dl className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3"><dt className="text-sa-muted">Situação</dt><dd><SubscriptionBadge subscription={selectedSubscription} /></dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-sa-muted">Plano cobrado</dt><dd className="font-semibold text-sa-text">{selectedSubscription?.plan ?? '—'}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-sa-muted">Forma de pagamento</dt><dd className="font-semibold text-sa-text">{selectedSubscription?.billingType ? billingTypeLabels[selectedSubscription.billingType] : '—'}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-sa-muted">Fim do teste grátis</dt><dd className="font-semibold text-sa-text">{selectedSubscription?.trialEndsAt ? new Date(selectedSubscription.trialEndsAt).toLocaleDateString('pt-BR') : '—'}</dd></div>
              <div className="flex items-center justify-between gap-3"><dt className="text-sa-muted">Próxima cobrança</dt><dd className="font-semibold text-sa-text">{selectedSubscription?.currentPeriodEnd ? new Date(selectedSubscription.currentPeriodEnd).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'}</dd></div>
            </dl>
          </SaasCard>

          <SaasCard title="Acessos" description={`${selectedTenantUsers.length} usuário(s)`}>
            <ul className="space-y-2.5">
              {selectedTenantUsers.map((user) => (
                <li key={user.id} className="flex items-center gap-3 rounded-xl border border-sa-border bg-sa-surface-2 p-3">
                  <Avatar name={user.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-sa-text">{user.name}</p>
                    <p className="truncate text-xs text-sa-muted">{user.username}</p>
                  </div>
                  <Pill tone="accent">{user.role}</Pill>
                </li>
              ))}
            </ul>
            {selectedTenantUsers.length === 0 ? <EmptyBlock icon={<KeyRound className="h-5 w-5" />} text="Nenhum acesso criado." /> : null}
          </SaasCard>
        </div>
      </div>
    </div>
  ) : (
    <SaasCard>
      <EmptyBlock icon={<Building2 className="h-5 w-5" />} text="Cliente não encontrado." />
      <div className="mt-4 flex justify-center"><Button type="button" onClick={() => navigate('/saas/clientes')}>Voltar para clientes</Button></div>
    </SaasCard>
  )

  const financialSection = (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.5fr)]">
        <FeaturedStat label="MRR · receita mensal recorrente" value={formatCurrency(monthlyRecurringRevenue)} caption={`${recurringSubscriptions.length} assinatura(s) paga(s) · ${trialCount} em teste`} icon={<TrendingUp className="h-5 w-5" />} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatTile tone="ok" label="Recebido no mês" value={formatCurrency(paidRevenue)} detail={`${paidThisMonth.length} cobrança(s) paga(s)`} icon={<CheckCircle2 className="h-[18px] w-[18px]" />} />
          <StatTile tone="warn" label="A receber" value={formatCurrency(openRevenue)} detail={`${billingInvoices.filter((invoice) => invoice.status === 'open').length} cobrança(s) em aberto`} icon={<Clock3 className="h-[18px] w-[18px]" />} />
          <StatTile tone="bad" label="Em atraso" value={formatCurrency(overdueRevenue)} detail={`${billingInvoices.filter((invoice) => invoice.status === 'overdue').length} cobrança(s) vencida(s)`} icon={<AlertTriangle className="h-[18px] w-[18px]" />} />
          <StatTile label="Taxa de recebimento" value={`${collectionRate}%`} detail="Pago sobre o total cobrado" icon={<ArrowUpRight className="h-[18px] w-[18px]" />} />
        </div>
      </div>

      <SaasCard title="Receita por mês" description="Últimos 6 meses: o que entrou e o que ainda está para entrar.">
        <RevenueChart invoices={billingInvoices} />
      </SaasCard>

      <SaasCard
        title="Cobranças"
        description={`${visibleInvoices.length} de ${billingInvoices.length} registro(s)`}
        action={<span className="rounded-full bg-sa-hover px-3 py-1.5 text-xs font-semibold text-sa-text-2">Total {formatCurrency(billableRevenue)}</span>}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {invoiceFilters.map((filter) => (
              <button
                key={filter.value}
                type="button"
                onClick={() => setInvoiceFilter(filter.value)}
                aria-pressed={invoiceFilter === filter.value}
                className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', invoiceFilter === filter.value ? 'border-sa-accent bg-sa-accent-soft text-sa-accent-text' : 'border-sa-border text-sa-muted hover:text-sa-text')}
              >
                {filter.label}
              </button>
            ))}
          </div>
          <label className="relative sm:w-64">
            <span className="sr-only">Buscar cliente</span>
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sa-soft" />
            <input value={invoiceQuery} onChange={(event) => setInvoiceQuery(event.target.value)} placeholder="Buscar cliente" className="h-10 w-full rounded-xl border border-sa-border bg-sa-surface-2 pl-9 pr-3 text-sm text-sa-text outline-none placeholder:text-sa-soft focus:border-sa-accent" />
          </label>
        </div>
        <InvoiceTable invoices={visibleInvoices} describe={describeInvoice} onOpenClient={openClient} emptyText={billingInvoices.length ? 'Nenhuma cobrança com esse filtro.' : 'As cobranças aparecem aqui quando os clientes contratam um plano.'} />
      </SaasCard>
    </div>
  )

  const accessGrid = 'lg:grid-cols-[minmax(220px,2fr)_minmax(140px,1.2fr)_140px_auto]'
  const accessSection = (
    <SaasCard>
      <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-sa-muted">{searchedUsers.length} acesso(s) de clientes</p>
        <SearchBox value={accessQuery} onChange={setAccessQuery} placeholder="Buscar acesso" />
      </div>
      {searchedUsers.length === 0 ? <EmptyBlock icon={<Users className="h-5 w-5" />} text={activeUsers.length ? 'Nenhum acesso com essa busca.' : 'Nenhum acesso de cliente criado.'} /> : (
        <div className="overflow-hidden rounded-xl border border-sa-border">
          <div className={cn('hidden gap-4 border-b border-sa-border bg-sa-surface-2 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.12em] text-sa-soft lg:grid', accessGrid)}>
            <span>Usuário</span><span>Restaurante</span><span>Função</span><span className="w-[84px]" />
          </div>
          <ul className="divide-y divide-sa-border">
            {searchedUsers.map((user) => (
              <li key={user.id} className="px-4 py-3.5 transition-colors hover:bg-sa-hover">
                {editingAccessId === user.id ? (
                  <form onSubmit={(event) => { void saveAccess(event, user) }} className="grid gap-3 md:grid-cols-2">
                    <Input value={editingAccessName} onChange={(event) => setEditingAccessName(event.target.value)} placeholder="Nome" />
                    <Input value={editingAccessUsername} onChange={(event) => setEditingAccessUsername(event.target.value)} placeholder="Usuário de login" autoCapitalize="none" />
                    <Input value={editingAccessEmail} onChange={(event) => setEditingAccessEmail(event.target.value)} placeholder="E-mail (opcional)" type="email" />
                    <select value={editingAccessRole} onChange={(event) => setEditingAccessRole(event.target.value)} className="h-11 w-full border px-4 text-sm outline-none">
                      <option value="admin">Administrador</option>
                      <option value="manager">Gerente</option>
                      <option value="operator">Operador</option>
                    </select>
                    <Input value={editingAccessShift} onChange={(event) => setEditingAccessShift(event.target.value)} placeholder="Turno ou função" className="md:col-span-2" />
                    <PasswordInput value={editingAccessPassword} onChange={setEditingAccessPassword} placeholder="Nova senha (opcional)" />
                    <PasswordInput value={editingAccessPasswordConfirm} onChange={setEditingAccessPasswordConfirm} placeholder="Confirmar nova senha" />
                    <div className="flex gap-2 md:col-span-2">
                      <Button type="submit" className="flex-1">Salvar</Button>
                      <Button type="button" variant="outline" onClick={cancelEditingAccess} aria-label="Cancelar edição"><X className="h-4 w-4" /></Button>
                    </div>
                  </form>
                ) : (
                  <div className={cn('grid gap-2 lg:items-center lg:gap-4', accessGrid)}>
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar name={user.name} />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-sa-text">{user.name}</p>
                        <p className="truncate text-xs text-sa-muted">{user.username}{user.email ? ` · ${user.email}` : ''}</p>
                      </div>
                    </div>
                    <p className="truncate text-sm text-sa-text-2">{tenantNameFor(user.restaurantId) || 'Cliente não identificado'}</p>
                    <Pill tone="accent">{user.role}</Pill>
                    <div className="flex items-center gap-1 lg:justify-end">
                      <button type="button" onClick={() => startEditingAccess(user)} aria-label={`Editar ${user.name}`} title="Editar" className="flex h-9 w-9 items-center justify-center rounded-lg text-sa-muted transition-colors hover:bg-sa-hover hover:text-sa-text"><Pencil className="h-4 w-4" /></button>
                      <ConfirmDialog
                        trigger={<button type="button" aria-label={`Excluir ${user.name}`} title="Excluir" className="flex h-9 w-9 items-center justify-center rounded-lg text-sa-bad transition-colors hover:bg-sa-bad-soft"><Trash2 className="h-4 w-4" /></button>}
                        title="Excluir acesso?"
                        description={`O usuário ${user.name} perderá imediatamente o acesso ao restaurante. Esta ação não pode ser desfeita.`}
                        confirmLabel="Excluir acesso"
                        onConfirm={() => { void removeAccess(user) }}
                      />
                    </div>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </SaasCard>
  )

  const plansSection = (
    <SaasCard
      title="Tabela de planos"
      description="Preço, descrição e disponibilidade de cada plano na página de vendas e no checkout."
      action={<Button type="button" onClick={savePlansConfiguration}>Salvar alterações</Button>}
    >
      <div className="mb-5 flex items-start gap-3 rounded-xl border border-sa-border-strong bg-sa-accent-soft p-4 text-sm leading-6 text-sa-text-2">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-sa-accent-text" />
        <p>Estes preços valem para a página de vendas e para o checkout. Quem já tem assinatura ativa mantém o valor atual até trocar de plano; ao trocar o plano de um cliente em Clientes, a cobrança no Asaas é atualizada para o preço de agora.</p>
      </div>
      {planConfigs.length === 0 ? <p className="text-sm text-sa-muted">Carregando os planos do servidor...</p> : null}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {planConfigs.map((config) => (
          <div key={config.key} className="rounded-xl border border-sa-border bg-sa-surface-2 p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="font-heading text-lg font-bold text-sa-text">{planLabels[config.key]}</p>
              <Pill tone={config.active ? 'ok' : 'neutral'}>{config.active ? 'Ativo' : 'Oculto'}</Pill>
            </div>
            <div className="mt-4 grid gap-3">
              <FormField label="Preço mensal (R$)"><Input value={String(config.price)} disabled={config.key === 'Free'} onChange={(event) => updatePlanConfig(config.key, { price: Number(event.target.value) || 0 })} inputMode="decimal" /></FormField>
              <FormField label="Descrição"><textarea value={config.description} onChange={(event) => updatePlanConfig(config.key, { description: event.target.value })} className="min-h-24 w-full border px-4 py-3 text-sm outline-none" /></FormField>
              <label className="flex items-center justify-between rounded-xl border border-sa-border bg-sa-surface px-4 py-3 text-sm font-semibold text-sa-text-2">Mostrar na página de vendas<input type="checkbox" checked={config.active} onChange={(event) => updatePlanConfig(config.key, { active: event.target.checked })} className="h-4 w-4" /></label>
            </div>
          </div>
        ))}
      </div>
    </SaasCard>
  )

  const activationsSection = (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,520px)_minmax(0,1fr)]">
      {activationForm}
      <SaasCard title="Clientes recentes" description="Os últimos restaurantes cadastrados.">
        <ul className="space-y-2.5">
          {clientTenants.slice(0, 8).map((tenant) => (
            <li key={tenant.id}>
              <button type="button" onClick={() => navigate(`/saas/clientes/${tenant.id}`)} className="flex w-full items-center gap-3 rounded-xl border border-sa-border bg-sa-surface-2 p-3 text-left transition-colors hover:border-sa-accent hover:bg-sa-hover">
                <Avatar name={tenant.restaurantName} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-sa-text">{tenant.restaurantName}</span>
                  <span className="block truncate text-xs text-sa-muted">{tenant.city}</span>
                </span>
                <Pill tone="accent">{tenant.plan}</Pill>
              </button>
            </li>
          ))}
        </ul>
        {clientTenants.length === 0 ? <EmptyBlock icon={<Building2 className="h-5 w-5" />} text="Nenhum cliente cadastrado." /> : null}
      </SaasCard>
    </div>
  )

  const leadStatusTones: Record<LeadStatus, PillTone> = { Novo: 'info', Contatado: 'warn', Convertido: 'ok', Perdido: 'neutral' }
  const changeLeadStatus = async (lead: Lead, status: LeadStatus) => {
    try {
      const updated = await updateLeadStatus(lead.id, status)
      setLeads((current) => current.map((item) => item.id === updated.id ? updated : item))
    } catch {
      toast.error('Não foi possível atualizar o lead.')
    }
  }
  const removeLead = async (lead: Lead) => {
    try {
      await deleteLead(lead.id)
      setLeads((current) => current.filter((item) => item.id !== lead.id))
    } catch {
      toast.error('Não foi possível excluir o lead.')
    }
  }
  const leadsSection = (
    <SaasCard title="Leads da página de vendas" description={`${leads.length} contato(s) de quem pediu para contratar`}>
      <div className="grid gap-3 lg:grid-cols-2">
        {leads.map((lead) => {
          const digits = lead.phone.replace(/\D/g, '')
          const whatsapp = digits ? `https://wa.me/${digits.startsWith('55') ? digits : `55${digits}`}` : ''
          return (
            <div key={lead.id} className="flex items-start gap-3 rounded-xl border border-sa-border bg-sa-surface-2 p-4">
              <Avatar name={lead.restaurantName} />
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-sa-text">{lead.restaurantName}</p>
                  <div className="flex shrink-0 items-center gap-1.5"><Pill tone={leadStatusTones[lead.status]}>{lead.status}</Pill><Pill tone="accent">{lead.plan}</Pill></div>
                </div>
                <p className="mt-0.5 text-sm text-sa-muted">{lead.ownerName} · {lead.city}</p>
                <p className="mt-0.5 truncate text-xs text-sa-soft">{lead.email} · {lead.phone} · {new Date(lead.createdAt).toLocaleDateString('pt-BR')}</p>
                {lead.notes ? <p className="mt-2 whitespace-pre-wrap text-sm text-sa-text-2">{lead.notes}</p> : null}
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  {whatsapp ? <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs font-semibold text-sa-accent-text hover:underline"><MessageCircle className="h-3.5 w-3.5" />Chamar no WhatsApp</a> : null}
                  <select value={lead.status} onChange={(event) => void changeLeadStatus(lead, event.target.value as LeadStatus)} aria-label="Situação do lead" className="h-8 border px-2 text-xs font-semibold outline-none">
                    <option>Novo</option><option>Contatado</option><option>Convertido</option><option>Perdido</option>
                  </select>
                  <ConfirmDialog
                    trigger={<button type="button" aria-label={`Excluir lead ${lead.restaurantName}`} title="Excluir lead" className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-sa-bad transition-colors hover:bg-sa-bad-soft"><Trash2 className="h-4 w-4" /></button>}
                    title="Excluir lead?"
                    description={`O contato de ${lead.restaurantName} será removido da lista.`}
                    confirmLabel="Excluir lead"
                    onConfirm={() => { void removeLead(lead) }}
                  />
                </div>
              </div>
            </div>
          )
        })}
      </div>
      {leads.length === 0 ? <EmptyBlock icon={<TrendingUp className="h-5 w-5" />} text="Nenhum lead capturado ainda." /> : null}
    </SaasCard>
  )

  const ticketTones: Record<SupportTicket['status'], PillTone> = { Aberto: 'warn', 'Em atendimento': 'info', Resolvido: 'ok' }
  const priorityTones: Record<SupportTicket['priority'], PillTone> = { Alta: 'bad', Média: 'warn', Baixa: 'neutral' }
  const visibleTickets = supportTickets.filter((ticket) => ticketFilter === 'all' || ticket.status === ticketFilter)
  const supportSection = (
    <SaasCard title="Chamados dos clientes" description="Responda e acompanhe os chamados abertos pelos lojistas.">
      <div className="mb-5">
        <FilterPills<'all' | SupportTicket['status']>
          value={ticketFilter}
          onChange={setTicketFilter}
          options={[
            { value: 'all', label: 'Todos', count: supportTickets.length },
            { value: 'Aberto', label: 'Abertos', count: supportTickets.filter((ticket) => ticket.status === 'Aberto').length },
            { value: 'Em atendimento', label: 'Em atendimento', count: supportTickets.filter((ticket) => ticket.status === 'Em atendimento').length },
            { value: 'Resolvido', label: 'Resolvidos', count: supportTickets.filter((ticket) => ticket.status === 'Resolvido').length },
          ]}
        />
      </div>
      <div className="space-y-3">
        {visibleTickets.map((ticket) => {
          const tenant = clientTenants.find((item) => item.id === ticket.tenantId)
          const draft = replyDrafts[ticket.id] ?? ticket.reply
          const selectClass = 'h-9 border px-3 text-xs font-semibold outline-none'
          return (
            <div key={ticket.id} className="rounded-xl border border-sa-border bg-sa-surface-2 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-semibold text-sa-text">{ticket.subject}</p>
                    <Pill tone={ticketTones[ticket.status]}>{ticket.status}</Pill>
                    <Pill tone={priorityTones[ticket.priority]}>Prioridade {ticket.priority.toLowerCase()}</Pill>
                  </div>
                  <p className="mt-1 text-xs text-sa-muted">{tenant?.restaurantName ?? ticket.tenantId}{ticket.createdBy ? ` · ${ticket.createdBy}` : ''} · {new Date(ticket.createdAt).toLocaleString('pt-BR')}</p>
                </div>
                <div className="flex gap-2">
                  <select value={ticket.priority} onChange={(event) => void saveTicket(ticket, { priority: event.target.value as SupportTicket['priority'] })} aria-label="Prioridade" className={selectClass}><option>Baixa</option><option>Média</option><option>Alta</option></select>
                  <select value={ticket.status} onChange={(event) => void saveTicket(ticket, { status: event.target.value as SupportTicket['status'] })} aria-label="Status" className={selectClass}><option>Aberto</option><option>Em atendimento</option><option>Resolvido</option></select>
                </div>
              </div>
              {ticket.message ? <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-sa-text-2">{ticket.message}</p> : null}
              <textarea value={draft} onChange={(event) => setReplyDrafts((current) => ({ ...current, [ticket.id]: event.target.value }))} placeholder="Resposta para o cliente" rows={2} maxLength={2000} className="mt-3 w-full resize-none border px-4 py-3 text-sm outline-none" />
              {draft !== ticket.reply ? <Button type="button" className="mt-2" onClick={() => void saveTicket(ticket, { reply: draft })}>Enviar resposta</Button> : null}
            </div>
          )
        })}
      </div>
      {visibleTickets.length === 0 ? <EmptyBlock icon={<MessageCircle className="h-5 w-5" />} text={supportTickets.length ? 'Nenhum chamado com esse filtro.' : 'Nenhum chamado aberto.'} /> : null}
    </SaasCard>
  )

  const overviewSection = (
    <div className="space-y-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1.5fr)]">
        <FeaturedStat label={`Receita de ${monthName}`} value={formatCurrency(paidRevenue)} caption={revenueDelta === null ? `${paidThisMonth.length} cobrança(s) paga(s) neste mês` : 'em relação ao mês anterior'} delta={revenueDelta} icon={<CircleDollarSign className="h-5 w-5" />} />
        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatTile tone="warn" label="A receber" value={formatCurrency(openRevenue)} detail={`${billingInvoices.filter((invoice) => invoice.status === 'open').length} cobrança(s) em aberto`} icon={<Clock3 className="h-[18px] w-[18px]" />} />
          <StatTile tone="bad" label="Em atraso" value={formatCurrency(overdueRevenue)} detail={`${billingInvoices.filter((invoice) => invoice.status === 'overdue').length} cobrança(s) vencida(s)`} icon={<AlertTriangle className="h-[18px] w-[18px]" />} />
          <StatTile label="Clientes ativos" value={String(activeTenants.length)} detail={`${inactiveTenants.length} inativo(s)`} icon={<Building2 className="h-[18px] w-[18px]" />} />
          <StatTile tone="ok" label="MRR" value={formatCurrency(monthlyRecurringRevenue)} detail={`${recurringSubscriptions.length} assinatura(s) paga(s)`} icon={<TrendingUp className="h-[18px] w-[18px]" />} />
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SaasCard title="Receita por mês" description="Últimos 6 meses: o que entrou e o que ainda está para entrar.">
          <RevenueChart invoices={billingInvoices} />
        </SaasCard>
        <SaasCard title="Assinaturas" description={`${clientTenants.length} cliente(s) na carteira`}>
          <SubscriptionMix counts={mixCounts} />
        </SaasCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SaasCard title="Cobranças recentes" action={<button type="button" onClick={() => navigate('/saas/financeiro')} className="text-sm font-semibold text-sa-accent-text hover:underline">Ver todas</button>}>
          <InvoiceTable invoices={billingInvoices.slice(0, 5)} describe={describeInvoice} onOpenClient={openClient} emptyText="As cobranças aparecem aqui quando os clientes contratam um plano." />
        </SaasCard>
        <SaasCard title="Atalhos">
          <div className="grid gap-2.5">
            {[
              { label: 'Ativar novo cliente', detail: 'Cadastrar restaurante e criar o acesso', to: '/saas/ativacoes', icon: UserPlus },
              { label: 'Ver financeiro', detail: 'Cobranças, recebimentos e atrasos', to: '/saas/financeiro', icon: CreditCard },
              { label: 'Abrir suporte', detail: 'Chamados dos lojistas', to: '/saas/suporte', icon: Users },
            ].map(({ label, detail, to, icon: Icon }) => (
              <button type="button" key={to} onClick={() => navigate(to)} className="flex items-center gap-3 rounded-xl border border-sa-border bg-sa-surface-2 p-3.5 text-left transition-colors hover:border-sa-accent hover:bg-sa-hover">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sa-accent-soft text-sa-accent-text"><Icon className="h-[18px] w-[18px]" /></div>
                <span className="min-w-0"><span className="block text-sm font-semibold text-sa-text">{label}</span><span className="block truncate text-xs text-sa-muted">{detail}</span></span>
              </button>
            ))}
          </div>
        </SaasCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SaasCard title="Acessos por cliente" action={<span className="rounded-full bg-sa-hover px-3 py-1 text-xs font-semibold text-sa-text-2">{activeUsers.length} usuário(s)</span>}>
          <AccessChart tenants={clientTenants} users={activeUsers} />
        </SaasCard>
        <SaasCard title="Últimos clientes">
          <div className="grid gap-2.5">
            {clientTenants.slice(0, 6).map((tenant) => (
              <button type="button" key={tenant.id} onClick={() => navigate(`/saas/clientes/${tenant.id}`)} className="rounded-xl border border-sa-border bg-sa-surface-2 p-3.5 text-left transition-colors hover:border-sa-accent hover:bg-sa-hover">
                <p className="text-sm font-semibold text-sa-text">{tenant.restaurantName}</p>
                <p className="mt-0.5 text-xs text-sa-muted">{planLabels[tenant.plan]} · {tenant.status === 'active' ? 'Ativo' : 'Inativo'}</p>
              </button>
            ))}
            {clientTenants.length === 0 ? <p className="text-sm text-sa-muted">Nenhum cliente cadastrado.</p> : null}
          </div>
        </SaasCard>
      </div>
    </div>
  )

  const auditSection = (
    <SaasCard title="Registro de ações" description="O que foi feito no painel, do mais recente para o mais antigo.">
      {auditLogs.length === 0 ? <EmptyBlock icon={<ReceiptText className="h-5 w-5" />} text="Nenhuma ação registrada." /> : (
        <ul className="divide-y divide-sa-border overflow-hidden rounded-xl border border-sa-border">
          {auditLogs.map((log) => (
            <li key={log.id} className="flex flex-col gap-1 px-4 py-3.5 transition-colors hover:bg-sa-hover sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-sa-text">{log.action}</p>
                <p className="truncate text-xs text-sa-muted">{log.target} · {log.actor}</p>
              </div>
              <p className="shrink-0 text-xs text-sa-soft">{new Date(log.createdAt).toLocaleString('pt-BR')}</p>
            </li>
          ))}
        </ul>
      )}
    </SaasCard>
  )

  const settingsSection = (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
      <form onSubmit={createSaasUser}>
        <SaasCard title="Criar usuário SaaS" description="Pessoa da equipe com acesso a este painel.">
          <div className="grid gap-3">
            <Input value={platformUserName} onChange={(event) => setPlatformUserName(event.target.value)} placeholder="Nome do usuário" />
            <Input value={platformUserUsername} onChange={(event) => setPlatformUserUsername(event.target.value)} placeholder="Usuário de login" autoCapitalize="none" />
            <Input value={platformUserEmail} onChange={(event) => setPlatformUserEmail(event.target.value)} placeholder="E-mail (opcional)" type="email" />
            <PasswordInput value={platformUserPassword} onChange={setPlatformUserPassword} placeholder="Senha inicial" />
          </div>
          <Button type="submit" className="mt-5 w-full"><UserCog className="mr-2 h-4 w-4" />Criar usuário do SaaS</Button>
        </SaasCard>
      </form>
      <SaasCard title="Usuários do SaaS" description={`${platformUsers.length} usuário(s) com acesso ao painel`}>
        <div className="grid gap-3 md:grid-cols-2">
          {platformUsers.map((user) => (
            <div key={user.id} className="rounded-xl border border-sa-border bg-sa-surface-2 p-4">
              {editingPlatformUserId === user.id ? (
                <form onSubmit={(event) => { void savePlatformUser(event, user) }} className="grid gap-3">
                  <Input value={editingPlatformUserName} onChange={(event) => setEditingPlatformUserName(event.target.value)} placeholder="Nome do usuário" />
                  <Input value={editingPlatformUserUsername} onChange={(event) => setEditingPlatformUserUsername(event.target.value)} placeholder="Usuário de login" autoCapitalize="none" />
                  <Input value={editingPlatformUserEmail} onChange={(event) => setEditingPlatformUserEmail(event.target.value)} placeholder="E-mail (opcional)" type="email" />
                  <Input value={editingPlatformUserPassword} onChange={(event) => setEditingPlatformUserPassword(event.target.value)} placeholder="Nova senha (mínimo 8 caracteres)" type="password" autoComplete="new-password" minLength={8} />
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">Salvar alterações</Button>
                    <Button type="button" variant="outline" onClick={cancelEditingPlatformUser} aria-label="Cancelar edição"><X className="h-4 w-4" /></Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar name={user.name} />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-sa-text">{user.name}</p>
                      <p className="truncate text-xs text-sa-muted">{user.username}{user.email ? ` · ${user.email}` : ''}</p>
                    </div>
                  </div>
                  <button type="button" onClick={() => startEditingPlatformUser(user)} className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-sa-border px-2.5 py-1.5 text-xs font-semibold text-sa-text-2 transition-colors hover:bg-sa-hover">
                    <Pencil className="h-3.5 w-3.5" />Editar
                  </button>
                </div>
              )}
              <div className="mt-4 grid gap-2">
                {Object.entries(platformPermissionLabels).map(([permission, label]) => (
                  <label key={permission} className="flex items-center justify-between gap-3 rounded-lg border border-sa-border bg-sa-surface px-3 py-2 text-xs font-semibold text-sa-text-2">
                    {label}
                    <input type="checkbox" checked={user.permissions.includes(permission)} onChange={() => { void togglePlatformPermission(user, permission) }} className="h-4 w-4" />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </SaasCard>
    </div>
  )

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite'
  const firstName = currentUser?.name?.split(' ')[0] ?? ''
  const viewTitles: Record<string, [string, string]> = {
    financeiro: ['Financeiro', 'Recebimentos, assinaturas e a saúde da carteira.'],
    clientes: ['Clientes', 'Restaurantes da carteira e os planos contratados.'],
    'cliente-detalhe': [selectedTenant?.restaurantName ?? 'Cliente', 'Dados, acessos, assinatura e cobranças.'],
    acessos: ['Acessos', 'Usuários dos restaurantes clientes.'],
    planos: ['Planos', 'Preços e textos usados na página de vendas e no checkout.'],
    ativacoes: ['Ativações', 'Cadastre um novo restaurante e crie o primeiro acesso.'],
    leads: ['Leads', 'Interessados que pediram contratação.'],
    suporte: ['Suporte', 'Chamados abertos pelos lojistas.'],
    auditoria: ['Auditoria', 'Registro das ações feitas no painel.'],
    configuracoes: ['Configurações', 'Ajustes gerais da plataforma.'],
  }
  const [pageTitle, pageDescription] = currentView ? viewTitles[currentView] ?? ['Painel SaaS', 'Administração da plataforma Vaija.'] : [`${greeting}${firstName ? `, ${firstName}` : ''}`, 'Veja como está a carteira do Vaija hoje.']

  return (
    <SaasLayout title={pageTitle} description={pageDescription}>
      {currentView === 'clientes' ? summaryCards : null}

      {currentView === 'cliente-detalhe' ? <div>{clientDetailSection}</div> : null}
      {currentView === 'financeiro' ? <div>{financialSection}</div> : null}
      {currentView === 'acessos' ? <div>{accessSection}</div> : null}
      {currentView === 'clientes' ? <div>{clientsSection}</div> : null}
      {currentView === 'planos' ? <div>{plansSection}</div> : null}
      {currentView === 'ativacoes' ? <div>{activationsSection}</div> : null}
      {currentView === 'leads' ? <div>{leadsSection}</div> : null}
      {currentView === 'suporte' ? <div>{supportSection}</div> : null}
      {currentView === 'auditoria' ? <div>{auditSection}</div> : null}
      {currentView === 'configuracoes' ? <div>{settingsSection}</div> : null}

      {!currentView ? overviewSection : null}
    </SaasLayout>
  )
}
