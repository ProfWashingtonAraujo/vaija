import { useEffect, useState } from 'react'
import { apiFetch } from '@/lib/api-client'
import type { SubscriptionStatus } from '@/lib/billing-api'

export type BillingAccess = { access: 'full' | 'restricted'; status: SubscriptionStatus }

const cacheTtlMs = 60_000
let cache: { userId: number; value: BillingAccess; at: number } | null = null

/** Descarta o resultado guardado; chamado depois de contratar, pagar ou cancelar. */
export function invalidateBillingAccess() {
  cache = null
}

async function loadBillingAccess(userId: number): Promise<BillingAccess> {
  if (cache && cache.userId === userId && Date.now() - cache.at < cacheTtlMs) return cache.value
  try {
    const response = await apiFetch('/api/billing/access')
    if (!response.ok) throw new Error(`billing_access_failed:${response.status}`)
    const data = await response.json() as BillingAccess
    cache = { userId, value: { access: data.access, status: data.status }, at: Date.now() }
    return cache.value
  } catch {
    // Se não deu para consultar, não trancamos o lojista por uma falha nossa.
    return { access: 'full', status: 'none' }
  }
}

/** null enquanto consulta; só consulta quando `userId` existe. */
export function useBillingAccess(userId: number | undefined) {
  const [state, setState] = useState<{ userId: number; value: BillingAccess } | null>(null)

  useEffect(() => {
    if (userId === undefined) return
    let cancelled = false
    void loadBillingAccess(userId).then((value) => {
      if (!cancelled) setState({ userId, value })
    })
    return () => {
      cancelled = true
    }
  }, [userId])

  return state && state.userId === userId ? state.value : null
}
