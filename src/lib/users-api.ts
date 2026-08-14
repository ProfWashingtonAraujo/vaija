import { getTenantId } from '@/lib/tenant-storage'
import { apiFetch } from '@/lib/api-client'

export type AppUser = {
  id: number
  name: string
  role: string
  roleKey: string
  shift: string
  email: string
  restaurantId: string
  tenantId?: string
  isPlatformAdmin?: boolean
  permissions: string[]
}

function normalizeRemoteUser(user: AppUser): AppUser {
	const tenantId = user.tenantId ?? 'default'
	return { ...user, tenantId, restaurantId: tenantId === 'default' ? 'taperas-pizzaria' : tenantId }
}

type StoredUser = AppUser & { password: string }

const localUsersKey = 'vaija.users'
const localSessionKey = 'vaija.localSession'

const roleLabels: Record<string, string> = {
  admin: 'Administrador',
  manager: 'Gerente',
  operator: 'Operador',
}

const rolePermissions: Record<string, string[]> = {
  admin: ['users:read', 'users:create', 'users:update', 'users:change-password', 'catalog:write', 'orders:write'],
  manager: ['users:read', 'users:change-password', 'catalog:write', 'orders:write'],
  operator: ['users:change-password', 'catalog:write', 'orders:write'],
}

export const platformPermissionLabels: Record<string, string> = {
  'saas:clients': 'Clientes',
  'saas:billing': 'Financeiro',
  'saas:support': 'Suporte',
  'saas:settings': 'Configurações',
}

const platformPermissions = Object.keys(platformPermissionLabels)

const defaultUsers: StoredUser[] = [
  {
    id: 1,
    name: 'Washington',
    role: 'Administrador SaaS',
    roleKey: 'admin',
    shift: 'Administração Vaija',
    email: 'admin@vaija.com.br',
    restaurantId: 'vaija-saas',
    tenantId: 'admin',
    isPlatformAdmin: true,
    permissions: platformPermissions,
    password: '123456',
  },
  {
    id: 2,
    name: 'Admin Taperas',
    role: 'Administrador',
    roleKey: 'admin',
    shift: 'Administração - Ativo',
    email: 'admin@taperaspizzaria.com.br',
    restaurantId: 'taperas-pizzaria',
    tenantId: 'default',
    permissions: rolePermissions.admin,
    password: '123456',
  },
  {
    id: 3,
    name: 'Gerente Teste',
    role: 'Gerente',
    roleKey: 'manager',
    shift: 'Gerência - Aberto',
    email: 'gerente@taperaspizzaria.com.br',
    restaurantId: 'taperas-pizzaria',
    tenantId: 'default',
    permissions: rolePermissions.manager,
    password: '123456',
  },
  {
    id: 4,
    name: 'Operador Teste',
    role: 'Operador',
    roleKey: 'operator',
    shift: 'Caixa 02 - Aberto',
    email: 'operador@taperaspizzaria.com.br',
    restaurantId: 'taperas-pizzaria',
    tenantId: 'default',
    permissions: rolePermissions.operator,
    password: '123456',
  },
]

function getPublicUser(user: StoredUser): AppUser {
  const { password: _password, ...publicUser } = user
  return publicUser
}

function ensureDefaultUsers(users: StoredUser[]) {
  let nextUsers: StoredUser[] = users.map((user) => user.email.toLowerCase() === 'contato@taperaspizzaria.com.br' || user.isPlatformAdmin ? { ...user, email: 'admin@vaija.com.br', restaurantId: 'vaija-saas', tenantId: 'admin', isPlatformAdmin: true, role: 'Administrador SaaS', shift: 'Administração Vaija', permissions: user.permissions.some((permission) => permission.startsWith('saas:')) ? user.permissions : platformPermissions } : { ...user, restaurantId: user.restaurantId ?? 'taperas-pizzaria', tenantId: user.tenantId ?? 'default' })

  for (const defaultUser of defaultUsers) {
    if (!nextUsers.some((user) => user.email.toLowerCase() === defaultUser.email.toLowerCase())) {
      const nextId = Math.max(0, ...nextUsers.map((user) => user.id)) + 1
      nextUsers = [...nextUsers, { ...defaultUser, id: nextId }]
    }
  }

  return nextUsers
}

function readStoredUsers() {
  const storedUsers = localStorage.getItem(localUsersKey)
  if (!storedUsers) {
    localStorage.setItem(localUsersKey, JSON.stringify(defaultUsers))
    return defaultUsers
  }

  const users = JSON.parse(storedUsers) as StoredUser[]
  const usersWithDefaults = ensureDefaultUsers(users)

  if (JSON.stringify(usersWithDefaults) !== JSON.stringify(users)) {
    saveStoredUsers(usersWithDefaults)
  }

  return usersWithDefaults
}

function saveStoredUsers(users: StoredUser[]) {
  localStorage.setItem(localUsersKey, JSON.stringify(users))
}

export async function fetchUsers() {
  const storedSession = localStorage.getItem(localSessionKey)
  const session = storedSession ? JSON.parse(storedSession) as AppUser : null
	if (!session?.isPlatformAdmin) {
		const response = await apiFetch('/api/users')
		if (!response.ok) throw new Error(`failed_to_fetch_users:${response.status}`)
		const result = await response.json() as { ok: true; users: AppUser[] }
		return { ...result, users: result.users.map(normalizeRemoteUser) }
	}
  const tenantId = getTenantId()
  const users = readStoredUsers().filter((user) => (!session || user.restaurantId === session.restaurantId) && user.tenantId === tenantId)

  return { ok: true, users: users.map(getPublicUser) } as const
}

export async function fetchAllUsers() {
  return { ok: true, users: readStoredUsers().map(getPublicUser) } as const
}

export async function createUser(input: { name: string; roleKey: string; shift: string; email: string; password: string }) {
  const users = readStoredUsers()
  const storedSession = localStorage.getItem(localSessionKey)
  const session = storedSession ? JSON.parse(storedSession) as AppUser : null
	if (!session?.isPlatformAdmin) {
		const response = await apiFetch('/api/users', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(input),
		})
		if (!response.ok) {
			const error = await response.json().catch(() => null) as { error?: string } | null
			throw new Error(error?.error ?? `failed_to_create_user:${response.status}`)
		}
		const result = await response.json() as { ok: true; user: AppUser }
		return { ...result, user: normalizeRemoteUser(result.user) }
	}
  const email = input.email.trim().toLowerCase()
  const tenantId = getTenantId()

  if (users.some((user) => user.email.toLowerCase() === email && user.tenantId === tenantId)) {
    throw new Error('email_already_exists')
  }

  const user: StoredUser = {
    id: Math.max(0, ...users.map((current) => current.id)) + 1,
    name: input.name.trim(),
    role: roleLabels[input.roleKey] ?? 'Operador',
    roleKey: input.roleKey,
    shift: input.shift.trim(),
    email,
    restaurantId: session?.restaurantId ?? 'taperas-pizzaria',
    tenantId,
    permissions: rolePermissions[input.roleKey] ?? [],
    password: input.password,
  }

  saveStoredUsers([...users, user])

  return { ok: true, user: getPublicUser(user) } as const
}

export async function createTenantAdminUser(input: { tenantId: string; name: string; email: string; password: string }) {
  const users = readStoredUsers()
  const email = input.email.trim().toLowerCase()

  if (users.some((user) => user.email.toLowerCase() === email && user.tenantId === input.tenantId)) {
    throw new Error('email_already_exists')
  }

  const user: StoredUser = {
    id: Math.max(0, ...users.map((current) => current.id)) + 1,
    name: input.name.trim(),
    role: roleLabels.admin,
    roleKey: 'admin',
    shift: 'Administrador - Ativo',
    email,
    restaurantId: input.tenantId,
    tenantId: input.tenantId,
    permissions: rolePermissions.admin,
    password: input.password,
  }

  saveStoredUsers([...users, user])
  return { ok: true, user: getPublicUser(user) } as const
}

export async function createPlatformUser(input: { name: string; email: string; password: string }) {
  const users = readStoredUsers()
  const email = input.email.trim().toLowerCase()

  if (users.some((user) => user.email.toLowerCase() === email)) {
    throw new Error('email_already_exists')
  }

  const user: StoredUser = {
    id: Math.max(0, ...users.map((current) => current.id)) + 1,
    name: input.name.trim(),
    role: 'Administrador SaaS',
    roleKey: 'admin',
    shift: 'Administração Vaija',
    email,
    restaurantId: 'vaija-saas',
    tenantId: 'admin',
    isPlatformAdmin: true,
    permissions: platformPermissions,
    password: input.password,
  }

  saveStoredUsers([...users, user])
  return { ok: true, user: getPublicUser(user) } as const
}

export async function updatePlatformUserPermissions(userId: number, permissions: string[]) {
  const users = readStoredUsers()
  const nextUsers = users.map((user) => user.id === userId && user.isPlatformAdmin ? { ...user, permissions } : user)
  saveStoredUsers(nextUsers)
  return { ok: true, users: nextUsers.map(getPublicUser) } as const
}

export async function resetUserPassword(userId: number, nextPassword: string) {
  const users = readStoredUsers()
  const nextUsers = users.map((user) => user.id === userId ? { ...user, password: nextPassword } : user)
  saveStoredUsers(nextUsers)
  return { ok: true } as const
}

export async function impersonateUser(userId: number) {
  const user = readStoredUsers().find((item) => item.id === userId)

  if (!user) {
    throw new Error('user_not_found')
  }

  localStorage.setItem(localSessionKey, JSON.stringify(getPublicUser(user)))
  return { ok: true, user: getPublicUser(user) } as const
}

export async function changeOwnPassword(currentPassword: string, nextPassword: string) {
  const storedSession = localStorage.getItem(localSessionKey)
  if (!storedSession) {
    throw new Error('not_authenticated')
  }

  const session = JSON.parse(storedSession) as AppUser
	if (!session.isPlatformAdmin) {
		const response = await apiFetch('/api/users/change-password', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ currentPassword, nextPassword }),
		})
		if (!response.ok) {
			const error = await response.json().catch(() => null) as { error?: string } | null
			throw new Error(error?.error ?? `failed_to_change_password:${response.status}`)
		}
		return
	}
  const users = readStoredUsers()
  const user = users.find((current) => current.id === session.id)

  if (!user || user.password !== currentPassword) {
    throw new Error('invalid_current_password')
  }

  const nextUsers = users.map((current) => current.id === session.id ? { ...current, password: nextPassword } : current)
  saveStoredUsers(nextUsers)
}
