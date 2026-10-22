import { useCallback, useEffect, useState } from 'react'

export type SaasTheme = 'light' | 'dark'

const storageKey = 'vaija.saas.theme'

function readTheme(): SaasTheme {
  try {
    const stored = localStorage.getItem(storageKey)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // sem acesso ao armazenamento: cai no tema do sistema
  }
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/** Tema claro/escuro do painel SaaS. A classe fica no <html> só enquanto o painel está montado. */
export function useSaasTheme() {
  const [theme, setTheme] = useState<SaasTheme>(readTheme)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('saas-dark', theme === 'dark')
    return () => root.classList.remove('saas-dark')
  }, [theme])

  const setAndStore = useCallback((next: SaasTheme) => {
    setTheme(next)
    try {
      localStorage.setItem(storageKey, next)
    } catch {
      // a escolha vale só nesta sessão
    }
  }, [])

  return { theme, setTheme: setAndStore }
}
