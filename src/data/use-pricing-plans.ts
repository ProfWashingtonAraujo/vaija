import { useCallback, useEffect, useMemo, useState } from 'react'
import { getPricingPlans } from '@/data/pricing-plans'
import { fetchPlanConfigs, type PlanConfig } from '@/lib/saas-api'

const cacheKey = 'vaija.plans.lastFromServer'

// Última resposta do servidor, só para a tela não ficar vazia enquanto ele acorda; nunca é uma fonte de preço.
function readCache(): PlanConfig[] | null {
  try {
    const stored = localStorage.getItem(cacheKey)
    return stored ? JSON.parse(stored) as PlanConfig[] : null
  } catch {
    return null
  }
}

function writeCache(configs: PlanConfig[]) {
  try {
    localStorage.setItem(cacheKey, JSON.stringify(configs))
  } catch {
    // sem armazenamento: só não guarda
  }
}

export type PricingStatus = 'loading' | 'ready' | 'error'

/** Planos com preço, texto e disponibilidade exatamente como o servidor os tem. */
export function usePricingPlans() {
  const [configs, setConfigs] = useState<PlanConfig[] | null>(readCache)
  const [status, setStatus] = useState<PricingStatus>(() => (readCache() ? 'ready' : 'loading'))
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false
    void fetchPlanConfigs()
      .then((fresh) => {
        if (cancelled) return
        writeCache(fresh)
        setConfigs(fresh)
        setStatus('ready')
      })
      .catch(() => {
        if (!cancelled) setStatus((current) => (current === 'ready' ? 'ready' : 'error'))
      })
    return () => {
      cancelled = true
    }
  }, [attempt])

  const plans = useMemo(() => (configs ? getPricingPlans(configs) : []), [configs])
  const retry = useCallback(() => {
    setStatus('loading')
    setAttempt((current) => current + 1)
  }, [])

  return { plans, status, retry }
}
