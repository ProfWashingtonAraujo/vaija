import { useEffect, useState, type FormEvent } from 'react'
import { Building2, CheckCircle2, CreditCard, KeyRound, Pencil, Trash2, TrendingUp, UserCog, UserPlus, Users, X } from 'lucide-react'
import { useNavigate, useParams } from 'react-router-dom'
import { toast } from 'sonner'
import { SaasLayout } from '@/components/layout/saas-layout'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ConfirmDialog } from '@/components/shared/confirm-dialog'
import { planLabels, type PlanKey } from '@/lib/plan-access'
import { createTenant, deleteTenant, readTenants, updateTenant, type Tenant, type TenantStatus } from '@/lib/tenants-api'
import { platformTenantId } from '@/lib/tenant-storage'
import { createPlatformUser, createTenantAdminUser, deleteTenantAccess, fetchAllUsers, impersonateUser, platformPermissionLabels, updatePlatformUser, updatePlatformUserPermissions, updateTenantAccess, type AppUser } from '@/lib/users-api'
import { formatCurrency } from '@/lib/formatters'
import { addAuditLog, createSupportTicket, readAuditLogs, readBillingInvoices, readPlanConfigs, readSupportTickets, saveBillingInvoices, savePlanConfigs, syncCurrentBillingInvoices, updateBillingInvoice, updateSupportTicket, type BillingInvoice, type PlanConfig, type SupportTicket } from '@/lib/saas-admin-api'

const defaultPlanPrices: Record<PlanKey, number> = {
  Free: 0,
  Start: 79,
  Pro: 149,
  Premium: 249,
}

const planOrder: PlanKey[] = ['Free', 'Start', 'Pro', 'Premium']

export function ActivationPage() {
  const navigate = useNavigate()
  const { view, tenantId } = useParams()
  const currentView = tenantId ? 'cliente-detalhe' : view
  const [tenants, setTenants] = useState<Tenant[]>(() => readTenants())
  const [users, setUsers] = useState<AppUser[]>([])
  const [planConfigs, setPlanConfigs] = useState<PlanConfig[]>(() => readPlanConfigs())
  const [billingInvoices, setBillingInvoices] = useState<BillingInvoice[]>(() => readBillingInvoices())
  const [supportTickets, setSupportTickets] = useState<SupportTicket[]>(() => readSupportTickets())
  const [auditLogs, setAuditLogs] = useState(() => readAuditLogs())
  const [restaurantName, setRestaurantName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [city, setCity] = useState('')
  const [plan, setPlan] = useState<PlanKey>('Pro')
  const [password, setPassword] = useState('')
  const [clientFilter, setClientFilter] = useState<'all' | PlanKey | TenantStatus>('all')
  const [supportTenantId, setSupportTenantId] = useState('')
  const [supportSubject, setSupportSubject] = useState('')
  const [supportPriority, setSupportPriority] = useState<SupportTicket['priority']>('Média')
  const [platformUserName, setPlatformUserName] = useState('')
  const [platformUserEmail, setPlatformUserEmail] = useState('')
  const [platformUserPassword, setPlatformUserPassword] = useState('')
  const [editingPlatformUserId, setEditingPlatformUserId] = useState<number | null>(null)
  const [editingPlatformUserName, setEditingPlatformUserName] = useState('')
  const [editingPlatformUserEmail, setEditingPlatformUserEmail] = useState('')
  const [editingPlatformUserPassword, setEditingPlatformUserPassword] = useState('')
  const [editingAccessId, setEditingAccessId] = useState<number | null>(null)
  const [editingAccessName, setEditingAccessName] = useState('')
  const [editingAccessEmail, setEditingAccessEmail] = useState('')
  const [editingAccessRole, setEditingAccessRole] = useState('operator')
  const [editingAccessShift, setEditingAccessShift] = useState('')
  const [editingAccessPassword, setEditingAccessPassword] = useState('')
  const [editingTenantId, setEditingTenantId] = useState<string | null>(null)
  const [editingRestaurantName, setEditingRestaurantName] = useState('')
  const [editingOwnerName, setEditingOwnerName] = useState('')
  const [editingTenantEmail, setEditingTenantEmail] = useState('')
  const [editingTenantPhone, setEditingTenantPhone] = useState('')
  const [editingTenantCity, setEditingTenantCity] = useState('')

  useEffect(() => {
    void fetchAllUsers().then((result) => setUsers(result.users))
  }, [tenants])

  const clientTenants = tenants.filter((tenant) => tenant.id !== platformTenantId)
  const filteredClientTenants = clientTenants.filter((tenant) => clientFilter === 'all' || tenant.plan === clientFilter || tenant.status === clientFilter)
  const activeTenants = clientTenants.filter((tenant) => tenant.status === 'active')
  const inactiveTenants = clientTenants.filter((tenant) => tenant.status === 'inactive')
  const planPrices = planConfigs.reduce((prices, config) => ({ ...prices, [config.key]: config.price }), defaultPlanPrices)
  const monthlyRecurringRevenue = activeTenants.reduce((sum, tenant) => sum + planPrices[tenant.plan], 0)
  const activeUsers = users.filter((user) => clientTenants.some((tenant) => tenant.id === user.restaurantId))
  const platformUsers = users.filter((user) => user.isPlatformAdmin)
  const usersByTenant = new Map(clientTenants.map((tenant) => [tenant.id, activeUsers.filter((user) => user.restaurantId === tenant.id)]))
  const selectedTenant = tenantId ? clientTenants.find((tenant) => tenant.id === tenantId) : undefined
  const selectedTenantUsers = selectedTenant ? usersByTenant.get(selectedTenant.id) ?? [] : []
  const selectedTenantInvoices = selectedTenant ? billingInvoices.filter((invoice) => invoice.tenantId === selectedTenant.id) : []
  const revenueByPlan = planOrder.map((currentPlan) => {
    const tenantsByPlan = activeTenants.filter((tenant) => tenant.plan === currentPlan)
    return {
      plan: currentPlan,
      clients: tenantsByPlan.length,
      revenue: tenantsByPlan.length * planPrices[currentPlan],
    }
  })

  const refreshData = () => {
    const nextTenants = readTenants()
    const nextClientTenants = nextTenants.filter((tenant) => tenant.id !== platformTenantId)
    const nextInvoices = syncCurrentBillingInvoices(nextClientTenants, planPrices)
    setTenants(nextTenants)
    void fetchAllUsers().then((result) => setUsers(result.users))
    setBillingInvoices(nextInvoices)
    setSupportTickets(readSupportTickets())
    setAuditLogs(readAuditLogs())
  }

  useEffect(() => {
    const nextClientTenants = tenants.filter((tenant) => tenant.id !== platformTenantId)
    const nextPlanPrices = planConfigs.reduce((prices, config) => ({ ...prices, [config.key]: config.price }), defaultPlanPrices)
    setBillingInvoices(syncCurrentBillingInvoices(nextClientTenants, nextPlanPrices))
  }, [tenants, planConfigs])

  const logAction = (action: string, target: string) => {
    addAuditLog({ action, target, actor: 'Administrador SaaS' })
    setAuditLogs(readAuditLogs())
  }

  const createClient = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const trimmedRestaurantName = restaurantName.trim()
    const trimmedOwnerName = ownerName.trim()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPhone = phone.trim()
    const trimmedCity = city.trim()

    if (!trimmedRestaurantName || !trimmedOwnerName || !trimmedEmail || !trimmedPhone || !trimmedCity || password.length < 8) {
      toast.error('Preencha cliente, responsável, contato, cidade e senha com 8 caracteres ou mais.')
      return
    }

    try {
      const tenant = createTenant({
        restaurantName: trimmedRestaurantName,
        ownerName: trimmedOwnerName,
        email: trimmedEmail,
        phone: trimmedPhone,
        city: trimmedCity,
        plan,
        status: 'active',
      })

      await createTenantAdminUser({ tenantId: tenant.id, name: trimmedOwnerName, email: trimmedEmail, password })
      logAction('Cliente ativado', `${tenant.restaurantName} · ${planLabels[tenant.plan]}`)
      refreshData()
      setRestaurantName('')
      setOwnerName('')
      setEmail('')
      setPhone('')
      setCity('')
      setPlan('Pro')
      setPassword('')
      toast.success('Cliente ativado e usuário administrador criado.')
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'email_already_exists' ? 'Já existe um usuário com esse e-mail.' : 'Não foi possível ativar o cliente.')
    }
  }

  const updateClient = (tenant: Tenant, values: { plan?: PlanKey; status?: TenantStatus }) => {
    updateTenant(tenant.id, values)
    refreshData()
    logAction(values.plan ? 'Plano alterado' : 'Status alterado', `${tenant.restaurantName} · ${values.plan ? planLabels[values.plan] : values.status}`)
    toast.success('Assinatura atualizada.')
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

  const savePlansConfiguration = () => {
    savePlanConfigs(planConfigs)
    setBillingInvoices(syncCurrentBillingInvoices(clientTenants, planPrices))
    logAction('Planos configurados', 'Tabela de planos')
    toast.success('Planos salvos e publicados na landing page.')
  }

  const setInvoiceStatus = (invoice: BillingInvoice, status: BillingInvoice['status']) => {
    const paidAt = status === 'paid' ? new Date().toISOString() : undefined
    setBillingInvoices(updateBillingInvoice(invoice.id, { status, paidAt }))
    logAction('Cobrança atualizada', `${invoice.referenceMonth} · ${status}`)
    toast.success('Cobrança atualizada.')
  }

  const togglePlatformPermission = async (user: AppUser, permission: string) => {
    const permissions = user.permissions.includes(permission) ? user.permissions.filter((item) => item !== permission) : [...user.permissions, permission]
    const result = await updatePlatformUserPermissions(user.id, permissions)
    setUsers(result.users)
    logAction('Permissões atualizadas', user.email)
    toast.success('Permissões atualizadas.')
  }

  const createTicket = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!supportTenantId || !supportSubject.trim()) {
      toast.error('Selecione o cliente e informe o assunto do suporte.')
      return
    }

    const tenant = clientTenants.find((item) => item.id === supportTenantId)
    createSupportTicket({ tenantId: supportTenantId, subject: supportSubject.trim(), priority: supportPriority, status: 'Aberto' })
    setSupportSubject('')
    setSupportPriority('Média')
    setSupportTenantId('')
    refreshData()
    logAction('Ticket criado', tenant?.restaurantName ?? 'Cliente')
    toast.success('Ticket de suporte criado.')
  }

  const exportClients = () => {
    const rows = ['Restaurante,Responsavel,Email,Cidade,Plano,Status', ...filteredClientTenants.map((tenant) => `${tenant.restaurantName},${tenant.ownerName},${tenant.email},${tenant.city},${tenant.plan},${tenant.status}`)]
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
    if (!platformUserName.trim() || !platformUserEmail.trim() || platformUserPassword.length < 8) {
      toast.error('Informe nome, e-mail e senha com 8 caracteres ou mais.')
      return
    }

    try {
      await createPlatformUser({ name: platformUserName, email: platformUserEmail, password: platformUserPassword })
      setPlatformUserName('')
      setPlatformUserEmail('')
      setPlatformUserPassword('')
      refreshData()
      logAction('Usuário SaaS criado', platformUserEmail)
      toast.success('Usuário interno do SaaS criado.')
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'email_already_exists' ? 'Já existe um usuário com esse e-mail.' : 'Não foi possível criar o usuário SaaS.')
    }
  }

  const startEditingPlatformUser = (user: AppUser) => {
    setEditingPlatformUserId(user.id)
    setEditingPlatformUserName(user.name)
    setEditingPlatformUserEmail(user.email)
    setEditingPlatformUserPassword('')
  }

  const cancelEditingPlatformUser = () => {
    setEditingPlatformUserId(null)
    setEditingPlatformUserName('')
    setEditingPlatformUserEmail('')
    setEditingPlatformUserPassword('')
  }

  const savePlatformUser = async (event: FormEvent<HTMLFormElement>, user: AppUser) => {
    event.preventDefault()
    if (!editingPlatformUserName.trim() || !editingPlatformUserEmail.trim() || (editingPlatformUserPassword && editingPlatformUserPassword.length < 8)) {
      toast.error('Informe nome e e-mail. A nova senha deve ter pelo menos 8 caracteres.')
      return
    }

    try {
      const updatedEmail = editingPlatformUserEmail.trim().toLowerCase()
      await updatePlatformUser(user.id, {
        name: editingPlatformUserName,
        email: updatedEmail,
        password: editingPlatformUserPassword || undefined,
        permissions: user.permissions,
      })
      cancelEditingPlatformUser()
      refreshData()
      logAction('Usuário SaaS atualizado', updatedEmail)
      toast.success('Usuário SaaS atualizado.')
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      const errorMessages: Record<string, string> = {
        email_already_exists: 'Já existe um usuário com esse e-mail.',
        invalid_platform_user: 'Confira nome, e-mail, permissões e use uma senha com pelo menos 8 caracteres.',
        user_not_found: 'O usuário SaaS não foi encontrado no banco de dados.',
        forbidden: 'Sua sessão não tem permissão para alterar este usuário.',
      }
      toast.error(errorMessages[message] ?? 'Não foi possível gravar as alterações no banco de dados.')
    }
  }

  const startEditingAccess = (user: AppUser) => {
    setEditingAccessId(user.id)
    setEditingAccessName(user.name)
    setEditingAccessEmail(user.email)
    setEditingAccessRole(user.roleKey)
    setEditingAccessShift(user.shift)
    setEditingAccessPassword('')
  }

  const cancelEditingAccess = () => {
    setEditingAccessId(null)
    setEditingAccessName('')
    setEditingAccessEmail('')
    setEditingAccessRole('operator')
    setEditingAccessShift('')
    setEditingAccessPassword('')
  }

  const saveAccess = async (event: FormEvent<HTMLFormElement>, user: AppUser) => {
    event.preventDefault()
    if (!editingAccessName.trim() || !editingAccessEmail.trim() || !editingAccessShift.trim() || (editingAccessPassword && editingAccessPassword.length < 8)) {
      toast.error('Preencha nome, e-mail e turno. A nova senha deve ter pelo menos 8 caracteres.')
      return
    }
    try {
      const updatedEmail = editingAccessEmail.trim().toLowerCase()
      await updateTenantAccess(user.id, {
        name: editingAccessName,
        email: updatedEmail,
        roleKey: editingAccessRole,
        shift: editingAccessShift,
        password: editingAccessPassword || undefined,
      })
      cancelEditingAccess()
      refreshData()
      logAction('Acesso atualizado', updatedEmail)
      toast.success('Acesso atualizado.')
    } catch (error) {
      toast.error(error instanceof Error && error.message === 'email_already_exists' ? 'Já existe um acesso com esse e-mail.' : 'Não foi possível atualizar o acesso.')
    }
  }

  const removeAccess = async (user: AppUser) => {
    try {
      await deleteTenantAccess(user.id)
      if (editingAccessId === user.id) cancelEditingAccess()
      refreshData()
      logAction('Acesso excluído', user.email)
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

  const saveTenant = (event: FormEvent<HTMLFormElement>, tenant: Tenant) => {
    event.preventDefault()
    if (!editingRestaurantName.trim() || !editingOwnerName.trim() || !editingTenantEmail.trim() || !editingTenantPhone.trim() || !editingTenantCity.trim()) {
      toast.error('Preencha restaurante, responsável, e-mail, telefone e cidade.')
      return
    }
    const updatedRestaurantName = editingRestaurantName.trim()
    updateTenant(tenant.id, {
      restaurantName: updatedRestaurantName,
      ownerName: editingOwnerName.trim(),
      email: editingTenantEmail.trim().toLowerCase(),
      phone: editingTenantPhone.trim(),
      city: editingTenantCity.trim(),
    })
    cancelEditingTenant()
    refreshData()
    logAction('Cliente atualizado', updatedRestaurantName)
    toast.success('Cliente atualizado.')
  }

  const removeTenant = async (tenant: Tenant, tenantUsers: AppUser[]) => {
    try {
      await Promise.all(tenantUsers.map((user) => deleteTenantAccess(user.id)))
      deleteTenant(tenant.id)
      saveBillingInvoices(readBillingInvoices().filter((invoice) => invoice.tenantId !== tenant.id))
      if (editingTenantId === tenant.id) cancelEditingTenant()
      refreshData()
      logAction('Cliente excluído', tenant.restaurantName)
      toast.success('Cliente e acessos vinculados excluídos.')
    } catch {
      toast.error('Não foi possível excluir o cliente.')
    }
  }

  const summaryCards = (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { label: 'Clientes ativos', value: activeTenants.length, icon: Building2, detail: `${inactiveTenants.length} inativo(s)` },
          { label: 'MRR estimado', value: formatCurrency(monthlyRecurringRevenue), icon: TrendingUp, detail: 'Receita mensal recorrente' },
          { label: 'Acessos criados', value: activeUsers.length, icon: KeyRound, detail: 'Usuários de clientes' },
          { label: 'Ticket médio', value: formatCurrency(activeTenants.length ? monthlyRecurringRevenue / activeTenants.length : 0), icon: CreditCard, detail: 'Por cliente ativo' },
        ].map(({ label, value, icon: Icon, detail }) => (
          <div key={label} className="rounded-[28px] border border-orange-100 bg-white p-5 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-500">{label}</p>
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><Icon className="h-5 w-5" /></div>
            </div>
            <p className="mt-4 font-heading text-3xl font-bold text-slate-900">{value}</p>
            <p className="mt-1 text-xs font-semibold text-slate-400">{detail}</p>
          </div>
        ))}
      </div>
  )

  const clientsSection = (
    <section className="rounded-[30px] border border-orange-100 bg-gradient-to-br from-white to-[#fffaf5] p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><Building2 className="h-5 w-5" /></div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Clientes</p>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Carteira SaaS</h2>
        </div>
        <Button type="button" variant="outline" onClick={exportClients}>Exportar CSV</Button>
      </div>
      <div className="mt-5 grid gap-3 md:grid-cols-[minmax(0,240px)_1fr] md:items-center">
        <select value={clientFilter} onChange={(event) => setClientFilter(event.target.value as 'all' | PlanKey | TenantStatus)} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
          <option value="all">Todos os clientes</option>
          <option value="active">Ativos</option>
          <option value="inactive">Inativos</option>
          {planOrder.map((item) => <option key={item} value={item}>{planLabels[item]}</option>)}
        </select>
        <p className="text-sm text-slate-500">{filteredClientTenants.length} cliente(s) encontrado(s).</p>
      </div>
      <div className="mt-6 space-y-3">
        {filteredClientTenants.map((tenant) => {
          const tenantUsers = usersByTenant.get(tenant.id) ?? []
          return (
            <div key={tenant.id} className="rounded-[24px] border border-orange-100 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
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
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="font-heading text-xl font-bold text-slate-900">{tenant.restaurantName}</p>
                    <p className="mt-1 text-sm text-slate-500">{tenant.ownerName} · {tenant.email}</p>
                    <p className="mt-1 text-sm text-slate-500">{tenant.city} · {tenant.phone}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{planLabels[tenant.plan]}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{tenant.status === 'active' ? 'Ativo' : 'Inativo'}</span>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{tenantUsers.length} acesso(s)</span>
                  </div>
                </div>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <select value={tenant.plan} onChange={(event) => updateClient(tenant, { plan: event.target.value as PlanKey })} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
                  {planOrder.map((item) => <option key={item} value={item}>{planLabels[item]}</option>)}
                </select>
                <select value={tenant.status} onChange={(event) => updateClient(tenant, { status: event.target.value as TenantStatus })} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
                  <option value="active">Ativo</option>
                  <option value="inactive">Inativo</option>
                </select>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => navigate(`/saas/clientes/${tenant.id}`)}>Ver detalhe</Button>
                <Button type="button" variant="outline" onClick={() => accessClient(tenant)}>Acessar como cliente</Button>
                <Button type="button" variant="outline" onClick={() => updateClient(tenant, { status: tenant.status === 'active' ? 'inactive' : 'active' })}>{tenant.status === 'active' ? 'Suspender assinatura' : 'Reativar assinatura'}</Button>
                <Button type="button" variant="outline" onClick={() => startEditingTenant(tenant)}><Pencil className="mr-2 h-4 w-4" />Editar</Button>
                <ConfirmDialog
                  trigger={<Button type="button" variant="outline" className="border-rose-200 text-rose-600 hover:border-rose-300 hover:text-rose-700"><Trash2 className="mr-2 h-4 w-4" />Excluir</Button>}
                  title="Excluir cliente?"
                  description={`O restaurante ${tenant.restaurantName}, seus acessos e cobranças serão removidos. Esta ação não pode ser desfeita.`}
                  confirmLabel="Excluir cliente"
                  onConfirm={() => { void removeTenant(tenant, tenantUsers) }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )

  const activationForm = (
    <form onSubmit={createClient} className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-orange-50 text-orange-600"><UserPlus className="h-5 w-5" /></div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Ativação</p>
          <h2 className="font-heading text-2xl font-bold text-slate-900">Novo cliente</h2>
        </div>
      </div>
      <div className="mt-6 grid gap-3">
        <Input value={restaurantName} onChange={(event) => setRestaurantName(event.target.value)} placeholder="Nome do restaurante" />
        <Input value={ownerName} onChange={(event) => setOwnerName(event.target.value)} placeholder="Responsável" />
        <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="E-mail do admin" type="email" />
        <Input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="WhatsApp" inputMode="tel" />
        <Input value={city} onChange={(event) => setCity(event.target.value)} placeholder="Cidade/UF" />
        <select value={plan} onChange={(event) => setPlan(event.target.value as PlanKey)} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
          {planOrder.map((item) => <option key={item} value={item}>{planLabels[item]} · {formatCurrency(planPrices[item])}/mês</option>)}
        </select>
        <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Senha inicial" type="password" />
      </div>
      <Button type="submit" className="mt-5 w-full"><CheckCircle2 className="mr-2 h-4 w-4" />Ativar plano e criar acesso</Button>
      <p className="mt-4 text-center text-xs leading-5 text-slate-500">O cliente acessa pelo e-mail informado e pela senha inicial cadastrada.</p>
    </form>
  )

  const clientDetailSection = selectedTenant ? (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <button type="button" onClick={() => navigate('/saas/clientes')} className="text-sm font-semibold text-orange-700">Voltar para clientes</button>
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-orange-600">Cliente</p>
            <h2 className="font-heading text-3xl font-bold text-slate-900">{selectedTenant.restaurantName}</h2>
            <p className="mt-2 text-sm text-slate-500">{selectedTenant.ownerName} · {selectedTenant.email}</p>
            <p className="mt-1 text-sm text-slate-500">{selectedTenant.city} · {selectedTenant.phone}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{planLabels[selectedTenant.plan]}</span>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">{selectedTenant.status === 'active' ? 'Ativo' : 'Inativo'}</span>
          </div>
        </div>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <select value={selectedTenant.plan} onChange={(event) => updateClient(selectedTenant, { plan: event.target.value as PlanKey })} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
            {planOrder.map((item) => <option key={item} value={item}>{planLabels[item]}</option>)}
          </select>
          <select value={selectedTenant.status} onChange={(event) => updateClient(selectedTenant, { status: event.target.value as TenantStatus })} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
            <option value="active">Ativo</option>
            <option value="inactive">Inativo</option>
          </select>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => accessClient(selectedTenant)}>Acessar como cliente</Button>
          <Button type="button" variant="outline" onClick={() => updateClient(selectedTenant, { status: selectedTenant.status === 'active' ? 'inactive' : 'active' })}>{selectedTenant.status === 'active' ? 'Suspender assinatura' : 'Reativar assinatura'}</Button>
        </div>
      </section>

      <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <h2 className="font-heading text-2xl font-bold text-slate-900">Acessos</h2>
        <div className="mt-5 space-y-3">
          {selectedTenantUsers.map((user) => <div key={user.id} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4"><p className="font-semibold text-slate-900">{user.name}</p><p className="mt-1 text-sm text-slate-500">{user.email} · {user.role}</p></div>)}
          {selectedTenantUsers.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center text-sm font-semibold text-slate-500">Nenhum acesso criado.</p> : null}
        </div>
      </section>

      <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)] xl:col-span-2">
        <h2 className="font-heading text-2xl font-bold text-slate-900">Cobranças</h2>
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {selectedTenantInvoices.map((invoice) => <div key={invoice.id} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{invoice.referenceMonth} · {formatCurrency(invoice.amount)}</p><p className="mt-1 text-sm text-slate-500">Vencimento {new Date(invoice.dueDate).toLocaleDateString('pt-BR')}</p></div><span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700">{{ paid: 'Pago', open: 'Aberto', overdue: 'Inadimplente', cancelled: 'Cancelado' }[invoice.status]}</span></div><div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={() => setInvoiceStatus(invoice, 'paid')}>Pago</Button><Button type="button" variant="outline" onClick={() => setInvoiceStatus(invoice, 'overdue')}>Inadimplente</Button></div></div>)}
        </div>
      </section>
    </div>
  ) : (
    <section className="rounded-[30px] border border-dashed border-orange-200 bg-orange-50/60 p-8 text-center">
      <h2 className="font-heading text-2xl font-bold text-slate-900">Cliente não encontrado</h2>
      <Button type="button" className="mt-4" onClick={() => navigate('/saas/clientes')}>Voltar para clientes</Button>
    </section>
  )

  const financialSection = (
    <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-orange-500" /><h2 className="font-heading text-2xl font-bold text-slate-900">Financeiro</h2></div>
      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        {revenueByPlan.map((item) => (
          <div key={item.plan} className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4">
            <div className="flex items-center justify-between gap-3"><p className="font-semibold text-slate-900">{planLabels[item.plan]}</p><p className="font-mono font-bold text-slate-900">{formatCurrency(item.revenue)}</p></div>
            <p className="mt-1 text-sm text-slate-500">{item.clients} cliente(s) ativo(s) · {formatCurrency(planPrices[item.plan])}/mês</p>
          </div>
        ))}
      </div>
      <div className="mt-6 space-y-3">
        {billingInvoices.map((invoice) => {
          const tenant = clientTenants.find((item) => item.id === invoice.tenantId)
          const statusLabel = { paid: 'Pago', open: 'Aberto', overdue: 'Inadimplente', cancelled: 'Cancelado' }[invoice.status]
          return (
            <div key={invoice.id} className="rounded-[24px] border border-orange-100 bg-orange-50/30 p-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{tenant?.restaurantName ?? 'Cliente'} · {invoice.referenceMonth}</p>
                  <p className="mt-1 text-sm text-slate-500">Vence em {new Date(invoice.dueDate).toLocaleDateString('pt-BR')} · {formatCurrency(invoice.amount)}</p>
                </div>
                <span className="w-fit rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700">{statusLabel}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button type="button" variant="outline" onClick={() => setInvoiceStatus(invoice, 'paid')}>Marcar pago</Button>
                <Button type="button" variant="outline" onClick={() => setInvoiceStatus(invoice, 'open')}>Marcar aberto</Button>
                <Button type="button" variant="outline" onClick={() => setInvoiceStatus(invoice, 'overdue')}>Marcar inadimplente</Button>
                {tenant ? <Button type="button" variant="outline" onClick={() => navigate(`/saas/clientes/${tenant.id}`)}>Ver cliente</Button> : null}
              </div>
            </div>
          )
        })}
        {billingInvoices.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center text-sm font-semibold text-slate-500">Nenhuma cobrança gerada.</p> : null}
      </div>
    </section>
  )

  const accessSection = (
    <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3"><Users className="h-5 w-5 text-orange-500" /><h2 className="font-heading text-2xl font-bold text-slate-900">Acessos</h2></div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {activeUsers.map((user) => {
          const tenant = clientTenants.find((item) => item.id === user.restaurantId)
          return (
            <div key={user.id} className="rounded-2xl border border-orange-100 bg-white p-4">
              {editingAccessId === user.id ? (
                <form onSubmit={(event) => { void saveAccess(event, user) }} className="grid gap-3">
                  <Input value={editingAccessName} onChange={(event) => setEditingAccessName(event.target.value)} placeholder="Nome" />
                  <Input value={editingAccessEmail} onChange={(event) => setEditingAccessEmail(event.target.value)} placeholder="E-mail" type="email" />
                  <select value={editingAccessRole} onChange={(event) => setEditingAccessRole(event.target.value)} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100">
                    <option value="admin">Administrador</option>
                    <option value="manager">Gerente</option>
                    <option value="operator">Operador</option>
                  </select>
                  <Input value={editingAccessShift} onChange={(event) => setEditingAccessShift(event.target.value)} placeholder="Turno ou função" />
                  <Input value={editingAccessPassword} onChange={(event) => setEditingAccessPassword(event.target.value)} placeholder="Nova senha (opcional)" type="password" />
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">Salvar</Button>
                    <Button type="button" variant="outline" onClick={cancelEditingAccess} aria-label="Cancelar edição"><X className="h-4 w-4" /></Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{user.name}</p>
                    <p className="mt-1 text-xs text-slate-500">{user.email}</p>
                    <p className="mt-1 text-xs text-slate-500">{tenant?.restaurantName ?? 'Cliente não identificado'}</p>
                    <span className="mt-2 inline-flex rounded-full border border-orange-200 bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700">{user.role}</span>
                  </div>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => startEditingAccess(user)} className="rounded-xl border border-orange-200 p-2 text-orange-700 transition hover:bg-orange-50" aria-label={`Editar ${user.name}`}><Pencil className="h-4 w-4" /></button>
                    <ConfirmDialog
                      trigger={<button type="button" className="rounded-xl border border-rose-200 p-2 text-rose-600 transition hover:bg-rose-50" aria-label={`Excluir ${user.name}`}><Trash2 className="h-4 w-4" /></button>}
                      title="Excluir acesso?"
                      description={`O usuário ${user.name} perderá imediatamente o acesso ao restaurante. Esta ação não pode ser desfeita.`}
                      confirmLabel="Excluir acesso"
                      onConfirm={() => { void removeAccess(user) }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
        {activeUsers.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center text-sm font-semibold text-slate-500">Nenhum acesso de cliente criado.</p> : null}
      </div>
    </section>
  )

  const plansSection = (
    <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3"><CreditCard className="h-5 w-5 text-orange-500" /><h2 className="font-heading text-2xl font-bold text-slate-900">Planos</h2></div>
        <Button type="button" onClick={savePlansConfiguration}>Salvar alterações</Button>
      </div>
      <div className="mt-5 grid gap-4 lg:grid-cols-4">
        {planConfigs.map((config) => (
          <div key={config.key} className="rounded-[24px] border border-orange-100 bg-orange-50/30 p-4">
            <p className="font-heading text-xl font-bold text-slate-900">{planLabels[config.key]}</p>
            <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">Preço mensal<Input value={String(config.price)} onChange={(event) => updatePlanConfig(config.key, { price: Number(event.target.value) || 0 })} inputMode="numeric" /></label>
            <label className="mt-3 grid gap-2 text-sm font-semibold text-slate-700">Descrição<textarea value={config.description} onChange={(event) => updatePlanConfig(config.key, { description: event.target.value })} className="min-h-24 rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100" /></label>
            <label className="mt-3 flex items-center justify-between rounded-2xl border border-orange-100 bg-white px-4 py-3 text-sm font-semibold text-slate-700">Plano ativo<input type="checkbox" checked={config.active} onChange={(event) => updatePlanConfig(config.key, { active: event.target.checked })} className="h-4 w-4 accent-orange-500" /></label>
          </div>
        ))}
      </div>
    </section>
  )

  const activationsSection = (
    <div className="grid items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      {activationForm}
      {clientsSection}
    </div>
  )

  const leads = JSON.parse(localStorage.getItem('vaija.planLeads') ?? '[]') as Array<{ id: number; plan: string; restaurantName: string; ownerName: string; phone: string; email: string; city: string; createdAt: string; status: string }>
  const leadsSection = (
    <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <div className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-orange-500" /><h2 className="font-heading text-2xl font-bold text-slate-900">Leads da landing</h2></div>
      <div className="mt-5 grid gap-3 lg:grid-cols-2">
        {leads.map((lead) => (
          <div key={lead.id} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{lead.restaurantName}</p><p className="mt-1 text-sm text-slate-500">{lead.ownerName} · {lead.city}</p><p className="mt-1 text-xs text-slate-500">{lead.email} · {lead.phone}</p></div><span className="rounded-full border border-orange-200 bg-white px-3 py-1 text-xs font-semibold text-orange-700">{lead.plan}</span></div>
          </div>
        ))}
        {leads.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center text-sm font-semibold text-slate-500">Nenhum lead capturado ainda.</p> : null}
      </div>
    </section>
  )

  const supportSection = (
    <div className="grid items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={createTicket} className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <h2 className="font-heading text-2xl font-bold text-slate-900">Novo ticket</h2>
        <div className="mt-5 grid gap-3">
          <select value={supportTenantId} onChange={(event) => setSupportTenantId(event.target.value)} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"><option value="">Selecione o cliente</option>{clientTenants.map((tenant) => <option key={tenant.id} value={tenant.id}>{tenant.restaurantName}</option>)}</select>
          <Input value={supportSubject} onChange={(event) => setSupportSubject(event.target.value)} placeholder="Assunto" />
          <select value={supportPriority} onChange={(event) => setSupportPriority(event.target.value as SupportTicket['priority'])} className="h-11 rounded-2xl border border-orange-100 bg-white px-4 text-sm text-slate-800 outline-none focus:border-orange-400 focus:ring-4 focus:ring-orange-100"><option>Baixa</option><option>Média</option><option>Alta</option></select>
        </div>
        <Button type="submit" className="mt-5 w-full">Criar ticket</Button>
      </form>
      <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <h2 className="font-heading text-2xl font-bold text-slate-900">Tickets</h2>
        <div className="mt-5 space-y-3">
          {supportTickets.map((ticket) => {
            const tenant = clientTenants.find((item) => item.id === ticket.tenantId)
            return <div key={ticket.id} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="font-semibold text-slate-900">{ticket.subject}</p><p className="mt-1 text-sm text-slate-500">{tenant?.restaurantName ?? 'Cliente'} · {ticket.priority}</p></div><select value={ticket.status} onChange={(event) => { updateSupportTicket(ticket.id, { status: event.target.value as SupportTicket['status'] }); refreshData(); logAction('Ticket atualizado', ticket.subject) }} className="h-10 rounded-2xl border border-orange-100 bg-white px-3 text-sm outline-none"><option>Aberto</option><option>Em atendimento</option><option>Resolvido</option></select></div></div>
          })}
          {supportTickets.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center text-sm font-semibold text-slate-500">Nenhum ticket aberto.</p> : null}
        </div>
      </section>
    </div>
  )

  const overviewSection = (
    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3"><TrendingUp className="h-5 w-5 text-orange-500" /><h2 className="font-heading text-2xl font-bold text-slate-900">Crescimento por plano</h2></div>
        <div className="mt-6 space-y-5">
          {revenueByPlan.map((item) => {
            const maxRevenue = Math.max(1, ...revenueByPlan.map((current) => current.revenue))
            const width = `${Math.max(8, item.revenue / maxRevenue * 100)}%`
            return (
              <div key={item.plan}>
                <div className="flex items-center justify-between gap-3 text-sm"><span className="font-semibold text-slate-700">{planLabels[item.plan]}</span><span className="font-mono font-bold text-slate-900">{formatCurrency(item.revenue)}</span></div>
                <div className="mt-2 h-3 rounded-full bg-orange-50"><div className="h-3 rounded-full bg-orange-500" style={{ width }} /></div>
                <p className="mt-1 text-xs text-slate-500">{item.clients} cliente(s) ativo(s)</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3"><Building2 className="h-5 w-5 text-orange-500" /><h2 className="font-heading text-2xl font-bold text-slate-900">Gestão rápida</h2></div>
        <div className="mt-5 grid gap-3">
          <button type="button" onClick={() => navigate('/saas/ativacoes')} className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4 text-left transition hover:border-orange-300 hover:bg-orange-50"><span className="font-semibold text-slate-900">Ativar novo cliente</span><span className="mt-1 block text-sm text-slate-500">Criar restaurante, plano e primeiro acesso.</span></button>
          <button type="button" onClick={() => navigate('/saas/financeiro')} className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4 text-left transition hover:border-orange-300 hover:bg-orange-50"><span className="font-semibold text-slate-900">Ver financeiro</span><span className="mt-1 block text-sm text-slate-500">MRR e receita por plano.</span></button>
          <button type="button" onClick={() => navigate('/saas/suporte')} className="rounded-2xl border border-orange-100 bg-orange-50/40 p-4 text-left transition hover:border-orange-300 hover:bg-orange-50"><span className="font-semibold text-slate-900">Abrir suporte</span><span className="mt-1 block text-sm text-slate-500">Tickets e prioridades dos clientes.</span></button>
        </div>
      </section>

      <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)] xl:col-span-2">
        <div className="flex items-center gap-3"><Users className="h-5 w-5 text-orange-500" /><h2 className="font-heading text-2xl font-bold text-slate-900">Últimos clientes</h2></div>
        <div className="mt-5 grid gap-3 lg:grid-cols-3">
          {clientTenants.slice(0, 6).map((tenant) => (
            <button type="button" key={tenant.id} onClick={() => navigate(`/saas/clientes/${tenant.id}`)} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4 text-left transition hover:border-orange-300 hover:bg-orange-50">
              <p className="font-semibold text-slate-900">{tenant.restaurantName}</p>
              <p className="mt-1 text-sm text-slate-500">{planLabels[tenant.plan]} · {tenant.status === 'active' ? 'Ativo' : 'Inativo'}</p>
            </button>
          ))}
        </div>
      </section>
    </div>
  )

  const auditSection = (
    <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
      <h2 className="font-heading text-2xl font-bold text-slate-900">Auditoria</h2>
      <div className="mt-5 space-y-3">
        {auditLogs.map((log) => <div key={log.id} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4"><p className="font-semibold text-slate-900">{log.action}</p><p className="mt-1 text-sm text-slate-500">{log.target} · {log.actor}</p><p className="mt-1 text-xs text-slate-400">{new Date(log.createdAt).toLocaleString('pt-BR')}</p></div>)}
        {auditLogs.length === 0 ? <p className="rounded-2xl border border-dashed border-orange-200 bg-orange-50/60 p-6 text-center text-sm font-semibold text-slate-500">Nenhuma ação registrada.</p> : null}
      </div>
    </section>
  )

  const settingsSection = (
    <div className="grid items-start gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={createSaasUser} className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <div className="flex items-center gap-3"><UserCog className="h-5 w-5 text-orange-500" /><h2 className="font-heading text-2xl font-bold text-slate-900">Criar usuário SaaS</h2></div>
        <div className="mt-5 grid gap-3">
          <Input value={platformUserName} onChange={(event) => setPlatformUserName(event.target.value)} placeholder="Nome do usuário" />
          <Input value={platformUserEmail} onChange={(event) => setPlatformUserEmail(event.target.value)} placeholder="E-mail do usuário SaaS" type="email" />
          <Input value={platformUserPassword} onChange={(event) => setPlatformUserPassword(event.target.value)} placeholder="Senha inicial" type="password" />
        </div>
        <Button type="submit" className="mt-5 w-full">Criar usuário do SaaS</Button>
      </form>
      <section className="rounded-[30px] border border-orange-100 bg-white p-6 shadow-[0_14px_36px_rgba(15,23,42,0.06)]">
        <h2 className="font-heading text-2xl font-bold text-slate-900">Usuários do SaaS</h2>
        <div className="mt-5 grid gap-3 md:grid-cols-2">
          {platformUsers.map((user) => (
            <div key={user.id} className="rounded-2xl border border-orange-100 bg-orange-50/30 p-4">
              {editingPlatformUserId === user.id ? (
                <form onSubmit={(event) => { void savePlatformUser(event, user) }} className="grid gap-3">
                  <Input value={editingPlatformUserName} onChange={(event) => setEditingPlatformUserName(event.target.value)} placeholder="Nome do usuário" />
                  <Input value={editingPlatformUserEmail} onChange={(event) => setEditingPlatformUserEmail(event.target.value)} placeholder="E-mail" type="email" />
                  <Input value={editingPlatformUserPassword} onChange={(event) => setEditingPlatformUserPassword(event.target.value)} placeholder="Nova senha (mínimo 8 caracteres)" type="password" autoComplete="new-password" minLength={8} />
                  <div className="flex gap-2">
                    <Button type="submit" className="flex-1">Salvar alterações</Button>
                    <Button type="button" variant="outline" onClick={cancelEditingPlatformUser} aria-label="Cancelar edição"><X className="h-4 w-4" /></Button>
                  </div>
                </form>
              ) : (
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">{user.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                  </div>
                  <button type="button" onClick={() => startEditingPlatformUser(user)} className="inline-flex items-center gap-1 rounded-xl border border-orange-200 bg-white px-3 py-2 text-xs font-semibold text-orange-700 transition-colors hover:bg-orange-50">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </button>
                </div>
              )}
              <div className="mt-4 grid gap-2">
                {Object.entries(platformPermissionLabels).map(([permission, label]) => (
                  <label key={permission} className="flex items-center justify-between gap-3 rounded-2xl border border-orange-100 bg-white px-3 py-2 text-xs font-semibold text-slate-700">
                    {label}
                    <input type="checkbox" checked={user.permissions.includes(permission)} onChange={() => { void togglePlatformPermission(user, permission) }} className="h-4 w-4 accent-orange-500" />
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )

  return (
    <SaasLayout title="Dashboard SaaS" description="Gerencie clientes, acessos, financeiro e ativação dos planos da plataforma Vaija.">
      {summaryCards}

      {currentView === 'cliente-detalhe' ? <div className="mt-6">{clientDetailSection}</div> : null}
      {currentView === 'financeiro' ? <div className="mt-6">{financialSection}</div> : null}
      {currentView === 'acessos' ? <div className="mt-6">{accessSection}</div> : null}
      {currentView === 'clientes' ? <div className="mt-6">{clientsSection}</div> : null}
      {currentView === 'planos' ? <div className="mt-6">{plansSection}</div> : null}
      {currentView === 'ativacoes' ? <div className="mt-6">{activationsSection}</div> : null}
      {currentView === 'leads' ? <div className="mt-6">{leadsSection}</div> : null}
      {currentView === 'suporte' ? <div className="mt-6">{supportSection}</div> : null}
      {currentView === 'auditoria' ? <div className="mt-6">{auditSection}</div> : null}
      {currentView === 'configuracoes' ? <div className="mt-6">{settingsSection}</div> : null}

      {!currentView ? overviewSection : null}
    </SaasLayout>
  )
}
