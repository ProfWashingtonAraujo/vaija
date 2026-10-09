import { useEffect, useState } from 'react'
import { defaultDeliverySettings, defaultRestaurantSettings, fetchPublicSettings, type PublicSettings } from '@/lib/settings'

const defaults: PublicSettings = { restaurant: defaultRestaurantSettings, delivery: defaultDeliverySettings }

/** Configurações públicas do restaurante (nome, logo, entrega) vindas do servidor, para o cliente sem login. */
export function usePublicSettings(tenantId: string) {
  const [state, setState] = useState<{ tenantId: string; settings: PublicSettings } | null>(null)

  useEffect(() => {
    let active = true
    void fetchPublicSettings(tenantId)
      .then((settings) => { if (active) setState({ tenantId, settings }) })
      .catch(() => { if (active) setState({ tenantId, settings: defaults }) })
    return () => { active = false }
  }, [tenantId])

  const ready = state?.tenantId === tenantId
  return { settings: ready ? state.settings : defaults, ready }
}
