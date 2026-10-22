import { createContext, useContext, useState, type PropsWithChildren } from 'react'

interface SidebarContextValue {
  collapsed: boolean
  toggle: () => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

const collapsedKey = 'vaija.store.sidebarCollapsed'

function readCollapsed() {
  try {
    return localStorage.getItem(collapsedKey) === 'true'
  } catch {
    return false
  }
}

/** `persist` guarda a escolha do menu entre telas; o menu do celular não persiste e abre sempre expandido. */
export function SidebarProvider({ children, persist = true }: PropsWithChildren<{ persist?: boolean }>) {
  const [collapsed, setCollapsed] = useState(() => (persist ? readCollapsed() : false))
  const toggle = () => {
    const next = !collapsed
    setCollapsed(next)
    if (!persist) return
    try {
      localStorage.setItem(collapsedKey, String(next))
    } catch {
      // preferência não guardada
    }
  }
  return <SidebarContext.Provider value={{ collapsed, toggle }}>{children}</SidebarContext.Provider>
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
  return ctx
}
