import { apiFetch } from '@/lib/api-client'

export type AuthUser = {
  id: number
  name: string
  role: string
  roleKey: string
  shift: string
  username: string
  email?: string
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
    username: 'admin',
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
    username: 'taperas',
    email: 'contato@taperaspizzaria.com.br',
    tenantId: 'default',
    restaurantId: 'taperas-pizzaria',
    permissions: rolePermissions.admin,
    password: '123456',
  },
  {
    id: 3,
    name: 'Admin Taperas (alt)',
    role: 'Administrador',
    roleKey: 'admin',
    shift: 'Administração - Ativo',
    username: 'admintaperas',
    email: 'admin@taperaspizzaria.com.br',
    tenantId: 'default',
    restaurantId: 'taperas-pizzaria',
    permissions: rolePermissions.admin,
    password: '123456',
  },
  {
    id: 4,
    name: 'Gerente Teste',
    role: 'Gerente',
    roleKey: 'manager',
    shift: 'Gerência - Aberto',
    username: 'gerente',
    email: 'gerente@taperaspizzaria.com.br',
    tenantId: 'default',
    restaurantId: 'taperas-pizzaria',
    permissions: rolePermissions.manager,
    password: '123456',
  },
  {
    id: 5,
    name: 'Operador Teste',
    role: 'Operador',
    roleKey: 'operator',
    shift: 'Caixa 02 - Aberto',
    username: 'operador',
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

// Usuários salvos antes do login por usuário só têm e-mail: o usuário vira a parte antes do '@'.
function withUsername(user: StoredUser): StoredUser {
  if (user.username) return user
  const base = (user.email ?? '').split('@')[0].toLowerCase().replace(/[^a-z0-9._-]+/g, '.').replace(/^[._-]+|[._-]+$/g, '')
  return { ...user, username: (base || 'usuario').padEnd(3, '0').slice(0, 30) }
}

function ensureDefaultUsers(users: StoredUser[]) {
  let nextUsers: StoredUser[] = users.map(withUsername).map((user) => user.username === 'contato' || user.isPlatformAdmin ? { ...user, username: 'admin', email: 'admin@vaija.com.br', tenantId: 'admin', restaurantId: 'vaija-saas', isPlatformAdmin: true, role: 'Administrador SaaS', shift: 'Administração Vaija' } : { ...user, tenantId: user.tenantId ?? 'default', restaurantId: user.restaurantId ?? 'taperas-pizzaria' })

  for (const defaultUser of defaultUsers) {
    if (!nextUsers.some((user) => user.username.toLowerCase() === defaultUser.username.toLowerCase())) {
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

export async function loginRequest(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase()
  if (offlineMode) {
    const localUser = readUsers().find((user) => user.username.toLowerCase() === normalizedUsername && user.password === password)
    if (!localUser) throw new Error('invalid_credentials')
    const publicUser = getPublicUser(localUser)
    localStorage.setItem(localSessionKey, JSON.stringify(publicUser))
    return { user: publicUser }
  }

  const tenantId = normalizedUsername === 'admin' ? 'admin' : undefined
  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: normalizedUsername, password, tenantId }),
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
