import { useEffect, useState } from 'react'
import { normalizeHex } from '@/lib/brand'

export function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || !import.meta.env.PROD) return
  window.addEventListener('load', () => { void navigator.serviceWorker.register('/sw.js').catch(() => undefined) })
}

/** Manifest por loja: ao instalar o link do cliente, o app leva o nome, a cor e a página da própria loja. */
export function useTenantManifest(tenantId: string, name: string, color: string | undefined, logo: string | undefined) {
  useEffect(() => {
    const link = document.querySelector<HTMLLinkElement>('link[rel="manifest"]')
    if (!link) return
    const original = link.href
    const startUrl = tenantId === 'default' ? '/pedido' : `/pedido/${encodeURIComponent(tenantId)}`
    const absolute = (path: string) => new URL(path, window.location.origin).toString()
    const icons = logo?.startsWith('data:image/')
      ? [{ src: logo, sizes: '512x512', type: logo.slice(5, logo.indexOf(';')) }]
      : [
        { src: absolute('/icon-192.png'), sizes: '192x192', type: 'image/png' },
        { src: absolute('/icon-512.png'), sizes: '512x512', type: 'image/png' },
      ]
    const manifest = {
      name, short_name: name.slice(0, 12), start_url: absolute(startUrl), scope: absolute(startUrl), display: 'standalone',
      orientation: 'portrait', background_color: '#ffffff', theme_color: normalizeHex(color), icons,
    }
    const blobUrl = URL.createObjectURL(new Blob([JSON.stringify(manifest)], { type: 'application/manifest+json' }))
    link.href = blobUrl
    return () => { link.href = original; URL.revokeObjectURL(blobUrl) }
  }, [tenantId, name, color, logo])
}

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
