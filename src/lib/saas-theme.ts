import { useCallback, useLayoutEffect, useState } from 'react'

export type SaasTheme = 'light' | 'dark'

const storageKey = 'vaija.saas.theme'
const storeStorageKey = 'vaija.store.theme'

function readTheme(key: string, followSystem: boolean): SaasTheme {
  try {
    const stored = localStorage.getItem(key)
    if (stored === 'light' || stored === 'dark') return stored
  } catch {
    // sem acesso ao armazenamento: cai no padrão
  }
  if (!followSystem) return 'light'
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function usePanelTheme(key: string, followSystem: boolean) {
  const [theme, setTheme] = useState<SaasTheme>(() => readTheme(key, followSystem))

  // layout effect: ao trocar de tela o cleanup e o novo efeito rodam juntos, sem piscar entre claro e escuro
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.add('saas-active')
    root.classList.toggle('saas-dark', theme === 'dark')
    return () => root.classList.remove('saas-active', 'saas-dark')
  }, [theme])

  const setAndStore = useCallback((next: SaasTheme) => {
    setTheme(next)
    try {
      localStorage.setItem(key, next)
    } catch {
      // a escolha vale só nesta sessão
    }
  }, [key])

  return { theme, setTheme: setAndStore }
}

/** Tema claro/escuro do painel SaaS. A classe fica no <html> só enquanto o painel está montado. */
export function useSaasTheme() {
  return usePanelTheme(storageKey, true)
}

/** Tema do painel da loja: começa claro; o modo escuro é uma escolha do lojista. */
export function useStoreTheme() {
  return usePanelTheme(storeStorageKey, false)
}
