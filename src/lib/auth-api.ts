import { apiFetch } from '@/lib/api-client'

export type AuthUser = {
  id: number
  name: string
  role: string
  roleKey: string
  shift: string
  email: string
  tenantId: string
  restaurantId: string
  isPlatformAdmin?: boolean
  permissions: string[]
}

const localSessionKey = 'vaija.localSession'
const localUsersKey = 'vaija.users'
const offlineMode = import.meta.env.VITE_OFFLINE_MODE === 'true'

type StoredUser = AuthUser & { password: string }

const rolePermissions: Record<string, string[]> = {
  admin: ['users:read', 'users:create', 'users:update', 'users:change-password', 'catalog:write', 'orders:write'],
  manager: ['users:read', 'users:change-password', 'catalog:write', 'orders:write'],
  operator: ['users:change-password', 'catalog:write', 'orders:write'],
}

const defaultUsers: StoredUser[] = [
  {
    id: 1,
    name: 'Washington',
    role: 'Administrador SaaS',
    roleKey: 'admin',
    shift: 'Administração Vaija',
    email: 'admin@vaija.com.br',
    tenantId: 'admin',
    restaurantId: 'vaija-saas',
    isPlatformAdmin: true,
    permissions: rolePermissions.admin,
    password: '123456',
  },
  {
    id: 2,
    name: 'Admin Taperas',
    role: 'Administrador',
    roleKey: 'admin',
    shift: 'Administração - Ativo',
    email: 'admin@taperaspizzaria.com.br',
    tenantId: 'default',
    restaurantId: 'taperas-pizzaria',
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
    tenantId: 'default',
    restaurantId: 'taperas-pizzaria',
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
    tenantId: 'default',
    restaurantId: 'taperas-pizzaria',
    permissions: rolePermissions.operator,
    password: '123456',
  },
]

function getPublicUser(user: StoredUser): AuthUser {
  const { password: _password, ...publicUser } = user
  return publicUser
}

function ensureDefaultUsers(users: StoredUser[]) {
  let nextUsers = users.map((user) => user.email.toLowerCase() === 'contato@taperaspizzaria.com.br' || user.isPlatformAdmin ? { ...user, email: 'admin@vaija.com.br', tenantId: 'admin', restaurantId: 'vaija-saas', isPlatformAdmin: true, role: 'Administrador SaaS', shift: 'Administração Vaija' } : { ...user, tenantId: user.tenantId ?? 'default', restaurantId: user.restaurantId ?? 'taperas-pizzaria' })

  for (const defaultUser of defaultUsers) {
    if (!nextUsers.some((user) => user.email.toLowerCase() === defaultUser.email.toLowerCase())) {
      const nextId = Math.max(0, ...nextUsers.map((user) => user.id)) + 1
      nextUsers = [...nextUsers, { ...defaultUser, id: nextId }]
    }
  }

  return nextUsers
}

function readUsers() {
  const storedUsers = localStorage.getItem(localUsersKey)
  if (!storedUsers) {
    localStorage.setItem(localUsersKey, JSON.stringify(defaultUsers))
    return defaultUsers
  }

  const users = JSON.parse(storedUsers) as StoredUser[]
  const usersWithDefaults = ensureDefaultUsers(users)

  if (JSON.stringify(usersWithDefaults) !== JSON.stringify(users)) {
    localStorage.setItem(localUsersKey, JSON.stringify(usersWithDefaults))
  }

  return usersWithDefaults
}

export async function loginRequest(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  if (offlineMode) {
    const localUser = readUsers().find((user) => user.email.toLowerCase() === normalizedEmail && user.password === password)
    if (!localUser) throw new Error('invalid_credentials')
    const publicUser = getPublicUser(localUser)
    localStorage.setItem(localSessionKey, JSON.stringify(publicUser))
    return { user: publicUser }
  }

  const tenantId = normalizedEmail === 'admin@vaija.com.br' ? 'admin' : 'default'
  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: normalizedEmail, password, tenantId }),
  }, false)
  if (response.status === 401) throw new Error('invalid_credentials')
  if (!response.ok) throw new Error('server_unavailable')
  const result = await response.json() as { user: Omit<AuthUser, 'restaurantId'> }
  const user = normalizeRemoteUser(result.user)
  localStorage.setItem(localSessionKey, JSON.stringify(user))
  return { user }
}

export async function fetchMe() {
  const storedUser = localStorage.getItem(localSessionKey)

  if (offlineMode) {
    if (!storedUser) throw new Error('failed_to_fetch_me')
    return { user: JSON.parse(storedUser) as AuthUser }
  }

  const response = await apiFetch('/api/auth/me')
  if (!response.ok) {
    localStorage.removeItem(localSessionKey)
    throw new Error('failed_to_fetch_me')
  }
  const result = await response.json() as { user: Omit<AuthUser, 'restaurantId'> }
  const user = normalizeRemoteUser(result.user)
  localStorage.setItem(localSessionKey, JSON.stringify(user))
  return { user }
}

export async function logoutRequest() {
  if (!offlineMode) {
    await apiFetch('/api/auth/logout', { method: 'POST' }, false)
  }
  localStorage.removeItem(localSessionKey)
}

function normalizeRemoteUser(user: Omit<AuthUser, 'restaurantId'>): AuthUser {
  const tenantId = user.tenantId || 'default'
  return {
    ...user,
    tenantId,
    restaurantId: tenantId === 'default' ? 'taperas-pizzaria' : tenantId,
    isPlatformAdmin: tenantId === 'admin' && user.roleKey === 'admin',
  }
}
