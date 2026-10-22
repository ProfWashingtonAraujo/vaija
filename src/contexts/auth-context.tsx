import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { fetchMe, loginRequest, logoutRequest, type AuthUser } from '@/lib/auth-api'
import { fetchMyTenant, placeholderTenant, type Tenant } from '@/lib/tenants-api'

type AuthContextValue = {
  user: AuthUser | null
  /** Cadastro da loja (plano e situação) como o servidor guarda. */
  tenant: Tenant | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (username: string, password: string) => Promise<{ user: AuthUser; tenant: Tenant }>
  logout: () => Promise<void>
  /** Recarrega o cadastro da loja, por exemplo depois de contratar um plano. */
  refreshTenant: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [tenant, setTenant] = useState<Tenant | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void fetchMe()
      .then((result) => {
        setUser(result.user)
        setTenant(result.tenant)
      })
      .catch(() => {
        setUser(null)
        setTenant(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = async (username: string, password: string) => {
    const session = await loginRequest(username, password)
    setUser(session.user)
    setTenant(session.tenant)
    return session
  }

  const logout = async () => {
    await logoutRequest()
    setUser(null)
    setTenant(null)
  }

  const refreshTenant = useCallback(async () => {
    setTenant(await fetchMyTenant())
  }, [])

  return <AuthContext.Provider value={{ user, tenant, isAuthenticated: Boolean(user), isLoading, login, logout, refreshTenant }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}

/** Cadastro da loja logada; nunca nulo para quem já está dentro do painel. */
export function useTenant() {
  return useAuth().tenant ?? placeholderTenant
}
