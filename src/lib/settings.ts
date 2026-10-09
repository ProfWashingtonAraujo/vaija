import { apiFetch } from '@/lib/api-client'
import { getTenantId, readTenantStorage, writeTenantStorage } from '@/lib/tenant-storage'

export type BusinessHour = {
  day: string
  enabled: boolean
  openTime: string
  closeTime: string
}

export type DeliverySettings = {
  mode: 'fixed' | 'perKm'
  fixedFee: string
  feePerKm: string
  originCep: string
}

export type RestaurantSettings = {
  name: string
  phone: string
  logo?: string
}

export type PaymentSettings = {
  pix: boolean
  card: boolean
  cash: boolean
}

export type PreferenceSettings = {
  compactPos: boolean
  theme: string
  density: 'comfortable' | 'compact'
  cardStyle: 'soft' | 'glass' | 'solid'
}

export type SubscriptionSettings = {
  plan: 'Start' | 'Pro' | 'Premium'
}

export type AppSettings = {
  restaurant: RestaurantSettings
  subscription: SubscriptionSettings
  businessHours: BusinessHour[]
  delivery: DeliverySettings
  payments: PaymentSettings
  preferences: PreferenceSettings
}

export const settingsKey = 'vaija.settings'
export const settingsUpdatedEvent = 'vaija.settings.updated'

export const defaultBusinessHours: BusinessHour[] = [
  { day: 'Segunda-feira', enabled: false, openTime: '17:00', closeTime: '23:30' },
  { day: 'Terça-feira', enabled: true, openTime: '17:00', closeTime: '23:30' },
  { day: 'Quarta-feira', enabled: true, openTime: '17:00', closeTime: '23:30' },
  { day: 'Quinta-feira', enabled: true, openTime: '17:00', closeTime: '23:30' },
  { day: 'Sexta-feira', enabled: true, openTime: '17:00', closeTime: '00:00' },
  { day: 'Sábado', enabled: true, openTime: '17:00', closeTime: '00:00' },
  { day: 'Domingo', enabled: true, openTime: '18:00', closeTime: '23:00' },
]

export const defaultDeliverySettings: DeliverySettings = {
  mode: 'fixed',
  fixedFee: '8,00',
  feePerKm: '2,50',
  originCep: '',
}

export const defaultRestaurantSettings: RestaurantSettings = {
  name: 'Taperas Pizzaria',
  phone: '(11) 4002-8922',
}

export const defaultSubscriptionSettings: SubscriptionSettings = {
  plan: 'Premium',
}

export const defaultPaymentSettings: PaymentSettings = {
  pix: true,
  card: true,
  cash: true,
}

export const defaultPreferenceSettings: PreferenceSettings = {
  compactPos: true,
  theme: 'Light Premium',
  density: 'comfortable',
  cardStyle: 'soft',
}

export function parseCurrencyInput(value: string) {
  return Number(value.replace(',', '.')) || 0
}

export function readSettings(): AppSettings {
  const defaultSettings = {
    restaurant: defaultRestaurantSettings,
    subscription: defaultSubscriptionSettings,
    businessHours: defaultBusinessHours,
    delivery: defaultDeliverySettings,
    payments: defaultPaymentSettings,
    preferences: defaultPreferenceSettings,
  }

  return mergeSettings(readTenantStorage(settingsKey, defaultSettings) as Partial<AppSettings>)
}

function mergeSettings(parsedSettings: Partial<AppSettings>): AppSettings {
  return {
    restaurant: { ...defaultRestaurantSettings, ...parsedSettings.restaurant },
    subscription: { ...defaultSubscriptionSettings, ...parsedSettings.subscription },
    businessHours: parsedSettings.businessHours ?? defaultBusinessHours,
    delivery: { ...defaultDeliverySettings, ...parsedSettings.delivery },
    payments: { ...defaultPaymentSettings, ...parsedSettings.payments },
    preferences: { ...defaultPreferenceSettings, ...parsedSettings.preferences },
  }
}

export function saveSettings(settings: AppSettings) {
  writeTenantStorage(settingsKey, settings)
  window.dispatchEvent(new CustomEvent(settingsUpdatedEvent, { detail: settings }))
}

const offlineMode = import.meta.env.VITE_OFFLINE_MODE === 'true'

export type PublicSettings = {
  restaurant: RestaurantSettings
  delivery: DeliverySettings
}

/** Configurações que o cliente (sem login) enxerga no link público: nome, logo e regras de entrega. */
export async function fetchPublicSettings(tenantId: string): Promise<PublicSettings> {
  if (offlineMode) {
    const local = readSettings()
    return { restaurant: local.restaurant, delivery: local.delivery }
  }
  const response = await apiFetch(`/api/public/${encodeURIComponent(tenantId)}/settings`, undefined, false)
  if (!response.ok) throw new Error(`failed_to_fetch_public_settings:${response.status}`)
  const data = await response.json() as Partial<PublicSettings>
  return {
    restaurant: { ...defaultRestaurantSettings, ...data.restaurant },
    delivery: { ...defaultDeliverySettings, ...data.delivery },
  }
}

/**
 * Painel: o servidor é a fonte da verdade (o navegador é só cache). Se o servidor ainda não tem
 * configurações, envia as deste navegador para ele, assim o que já foi configurado não se perde.
 */
export async function syncSettingsFromServer(): Promise<AppSettings | null> {
  if (offlineMode) return null
  const response = await apiFetch('/api/settings', { headers: { 'X-Tenant-Id': getTenantId() } })
  if (!response.ok) throw new Error(`failed_to_fetch_settings:${response.status}`)
  const { settings } = await response.json() as { settings: Partial<AppSettings> | null }
  if (!settings) {
    await pushSettingsToServer(readSettings()).catch(() => undefined)
    return null
  }
  const merged = mergeSettings(settings)
  writeTenantStorage(settingsKey, merged)
  window.dispatchEvent(new CustomEvent(settingsUpdatedEvent, { detail: merged }))
  return merged
}

export async function pushSettingsToServer(settings: AppSettings) {
  if (offlineMode) return
  const response = await apiFetch('/api/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'X-Tenant-Id': getTenantId() },
    body: JSON.stringify({ settings }),
  })
  if (!response.ok) throw new Error(`failed_to_save_settings:${response.status}`)
}
