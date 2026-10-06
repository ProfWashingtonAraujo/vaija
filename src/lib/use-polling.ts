import { useEffect, useRef } from 'react'

/**
 * Chama `callback` a cada `intervalMs` enquanto a aba estiver visível e também ao voltar o foco
 * para a janela. Não roda na montagem: a tela já faz a primeira carga por conta própria.
 */
export function usePolling(callback: () => void | Promise<unknown>, intervalMs = 10_000) {
  const latest = useRef(callback)

  useEffect(() => {
    latest.current = callback
  })

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') void latest.current()
    }
    const timer = window.setInterval(run, intervalMs)
    document.addEventListener('visibilitychange', run)
    window.addEventListener('focus', run)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', run)
      window.removeEventListener('focus', run)
    }
  }, [intervalMs])
}
