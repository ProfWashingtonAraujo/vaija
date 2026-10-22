import { useEffect, useState } from 'react'

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => undefined) })
}

/** Manifest por loja: ao instalar o link do cliente, o app leva o nome, a cor e a página da própria loja. */
export function useTenantManifest(tenantId: string) {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!link) return
    const original = link.href
    link.href = tenantManifestUrl(tenantId)
    return () => { link.href = original }
  }, [tenantId])
}

/** Precisa ser uma URL real: o Chrome do Android não instala a partir de manifest blob:. */
export const tenantManifestUrl = (tenantId: string) => `/api/public/${encodeURIComponent(tenantId)}/manifest.webmanifest`

type InstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }> }

/** Controla o botão "Instalar app": no Android usa o aviso nativo; no iPhone só dá para orientar o usuário. */
export function useInstallApp() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(() => window.matchMedia('(display-mode: standalone)').matches)
  const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)

  useEffect(() => {
    const onPrompt = (event: Event) => { event.preventDefault(); setPromptEvent(event as InstallPromptEvent) }
    const onInstalled = () => { setInstalled(true); setPromptEvent(null) }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const install = async () => {
    if (!promptEvent) return
    await promptEvent.prompt()
    await promptEvent.userChoice
    setPromptEvent(null)
  }

  return { canInstall: !installed && (promptEvent !== null || isIos), isIos, install }
}
