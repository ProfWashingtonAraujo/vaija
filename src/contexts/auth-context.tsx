import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react'
import { fetchMe, loginRequest, logoutRequest, type AuthUser } from '@/lib/auth-api'

type AuthContextValue = {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    void fetchMe()
      .then((result) => {
        setUser(result.user)
      })
      .catch(() => {
        setUser(null)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = async (email: string, password: string) => {
    const session = await loginRequest(email, password)
    setUser(session.user)
    return session.user
  }

  const logout = async () => {
    await logoutRequest()
    setUser(null)
  }

  return <AuthContext.Provider value={{ user, isAuthenticated: Boolean(user), isLoading, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }

  return context
}
