const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? ''

async function request(path: string, init?: RequestInit) {
  return fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  })
}

export async function apiFetch(path: string, init?: RequestInit, retryOnAuth = true) {
  const response = await request(path, init)

  if (response.status === 401 && retryOnAuth && path !== '/api/auth/login' && path !== '/api/auth/refresh' && path !== '/api/auth/logout') {
    const refreshed = await request('/api/auth/refresh', { method: 'POST' })

    if (refreshed.ok) {
      return request(path, init)
    }
  }

  return response
}
