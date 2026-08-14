const apiBaseUrl = import.meta.env.DEV ? '' : (import.meta.env.VITE_API_BASE_URL ?? '')

async function request(path: string, init?: RequestInit) {
  return fetch(`${apiBaseUrl}${path}`, {
    credentials: 'include',
    ...init,
    headers: {
      ...(init?.headers ?? {}),
    },
  })
}

let refreshRequest: Promise<boolean> | null = null

async function refreshSession() {
  if (!refreshRequest) {
    refreshRequest = request('/api/auth/refresh', { method: 'POST' })
      .then((response) => response.ok)
      .finally(() => {
        refreshRequest = null
      })
  }
  return refreshRequest
}

export async function apiFetch(path: string, init?: RequestInit, retryOnAuth = true) {
  const response = await request(path, init)

  if (response.status === 401 && retryOnAuth && path !== '/api/auth/login' && path !== '/api/auth/refresh' && path !== '/api/auth/logout') {
    if (await refreshSession()) {
      return request(path, init)
    }
  }

  return response
}
