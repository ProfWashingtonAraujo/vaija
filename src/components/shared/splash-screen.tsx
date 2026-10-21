import { useEffect, useState } from 'react'
import { UtensilsCrossed } from 'lucide-react'

type SplashScreenProps = {
  name: string
  logo?: string
  tagline?: string
  ready: boolean
  storageKey: string
}

const minimumVisibleMs = 1200

/** Abertura com a marca da loja. Aparece uma vez por sessão, depois que as configurações da loja chegam. */
export function SplashScreen({ name, logo, tagline = 'Peça fácil, receba rápido', ready, storageKey }: SplashScreenProps) {
  const [visible, setVisible] = useState(() => {
    try { return sessionStorage.getItem(storageKey) !== '1' } catch { return true }
  })
  const [leaving, setLeaving] = useState(false)

  useEffect(() => {
    if (!visible || !ready) return
    const leave = window.setTimeout(() => setLeaving(true), minimumVisibleMs)
    const done = window.setTimeout(() => {
      setVisible(false)
      try { sessionStorage.setItem(storageKey, '1') } catch { /* sem armazenamento: mostra de novo na próxima visita */ }
    }, minimumVisibleMs + 400)
    return () => { window.clearTimeout(leave); window.clearTimeout(done) }
  }, [visible, ready, storageKey])

  if (!visible) return null

  return (
    <div
      role="status"
      aria-label={`Carregando ${name}`}
      className={`fixed inset-0 z-[100] flex flex-col items-center justify-center gap-5 bg-white px-8 text-center transition-opacity duration-400 ${leaving ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[32px] bg-orange-500 text-white shadow-[0_24px_60px_rgba(0,0,0,0.18)] animate-pulse">
        {logo ? <img src={logo} alt="" className="h-full w-full object-cover" /> : <UtensilsCrossed className="h-12 w-12" />}
      </div>
      <div>
        <p className="font-heading text-4xl font-extrabold tracking-tight text-slate-900">{ready ? name : '\u00a0'}<span className="text-orange-500">.</span></p>
        <p className="mt-2 text-sm font-medium text-slate-500">{tagline}</p>
      </div>
    </div>
  )
}
