import { useEffect, useState } from 'react'
import { getPricingPlans } from '@/data/pricing-plans'
import { fetchPlanConfigs } from '@/lib/saas-api'

/** Planos com o preço e o texto que o dono salvou no servidor (os padrões aparecem enquanto carrega). */
export function usePricingPlans() {
  const [plans, setPlans] = useState(() => getPricingPlans())

  useEffect(() => {
    let cancelled = false
    void fetchPlanConfigs()
      .then((configs) => {
        if (!cancelled) setPlans(getPricingPlans(configs))
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [])

  return plans
}
