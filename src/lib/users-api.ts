import { apiFetch } from '@/lib/api-client'

export type AppUser = {
  id: number
  name: string
  role: string
  roleKey: string
  shift: string
  email: string
  permissions: string[]
}

export async function fetchUsers() {
  const response = await apiFetch('/api/users')

  if (!response.ok) {
    throw new Error('failed_to_fetch_users')
  }

  return response.json() as Promise<{ ok: true; users: AppUser[] }>
}

export async function createUser(input: { name: string; roleKey: string; shift: string; email: string; password: string }) {
  const response = await apiFetch('/api/users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!response.ok) {
    throw new Error('failed_to_create_user')
  }

  return response.json() as Promise<{ ok: true; user: AppUser }>
}

export async function changeOwnPassword(currentPassword: string, nextPassword: string) {
  const response = await apiFetch('/api/users/change-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ currentPassword, nextPassword }),
  })

  if (!response.ok) {
    throw new Error('failed_to_change_password')
  }
}
