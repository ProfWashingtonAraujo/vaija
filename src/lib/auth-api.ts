import { apiFetch } from '@/lib/api-client'

export type AuthUser = {
  id: number
  name: string
  role: string
  roleKey: string
  shift: string
  email: string
  permissions: string[]
}

export async function loginRequest(email: string, password: string) {
  const response = await apiFetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  })

  if (!response.ok) {
    throw new Error('failed_to_login')
  }

  return response.json() as Promise<{ user: AuthUser }>
}

export async function fetchMe() {
  const response = await apiFetch('/api/auth/me')

  if (!response.ok) {
    throw new Error('failed_to_fetch_me')
  }

  return response.json() as Promise<{ user: AuthUser }>
}

export async function logoutRequest() {
  await apiFetch('/api/auth/logout', { method: 'POST' }, false)
}
