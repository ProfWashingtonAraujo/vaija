import { readTenantStorage, writeTenantStorage } from '@/lib/tenant-storage'

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

  const parsedSettings = readTenantStorage(settingsKey, defaultSettings) as Partial<AppSettings>
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
