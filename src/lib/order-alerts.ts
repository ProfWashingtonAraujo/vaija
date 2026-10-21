import { useSyncExternalStore } from 'react'
import { toast } from 'sonner'
import type { Order } from '@/data/mock-orders'
import { fetchOrders } from '@/lib/orders-api'
import { getTenantId } from '@/lib/tenant-storage'

export type OrderAlert = {
  orderId: number
  customer: string
  source: Order['source']
  tableNumber?: string
  value: number
  at: number
}

type AlertState = { items: OrderAlert[]; unread: number; soundOn: boolean }

const soundKey = 'vaija.alerts.sound'
const maxItems = 30
const minCheckGapMs = 5_000

function readSoundPreference() {
  try {
    return localStorage.getItem(soundKey) !== 'off'
  } catch {
    return true
  }
}

let state: AlertState = { items: [], unread: 0, soundOn: readSoundPreference() }
const listeners = new Set<() => void>()

// Pedidos já vistos neste navegador. A primeira carga só forma a base: não avisa o que já existia.
let seenIds: Set<number> | null = null
let seenTenant = ''
let lastCheck = 0

function setState(next: Partial<AlertState>) {
  state = { ...state, ...next }
  listeners.forEach((listener) => listener())
}

let audio: AudioContext | null = null

/** O navegador só libera som depois de um toque na tela: prepara o áudio no primeiro toque. */
async function unlockAudio() {
  try {
    audio ??= new AudioContext()
    if (audio.state === 'suspended') await audio.resume()
  } catch {
    // sem suporte a áudio: o aviso continua visual
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', () => void unlockAudio(), { once: true })
  window.addEventListener('keydown', () => void unlockAudio(), { once: true })
}

export function playAlertSound() {
  if (!audio || audio.state !== 'running') return
  const now = audio.currentTime
  ;[880, 1175].forEach((frequency, index) => {
    const oscillator = audio!.createOscillator()
    const gain = audio!.createGain()
    const start = now + index * 0.18
    oscillator.type = 'sine'
    oscillator.frequency.value = frequency
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.25, start + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.28)
    oscillator.connect(gain).connect(audio!.destination)
    oscillator.start(start)
    oscillator.stop(start + 0.3)
  })
}

/** Registra pedidos criados neste aparelho (ex.: no PDV) para não avisar quem acabou de criá-los. */
export function markOrderSeen(orderId: number) {
  seenIds?.add(orderId)
}

export function processOrders(orders: Order[]) {
  const tenant = getTenantId()
  if (seenIds === null || seenTenant !== tenant) {
    seenIds = new Set(orders.map((order) => order.id))
    seenTenant = tenant
    return
  }

  const fresh = orders.filter((order) => !seenIds!.has(order.id))
  orders.forEach((order) => seenIds!.add(order.id))
  // pedido de mesa é lançado pela própria equipe: o aviso é para o que chega de fora
  const incoming = fresh.filter((order) => order.status === 'Pendente' && order.source !== 'Mesa')
  if (incoming.length === 0) return

  const alerts = incoming.map<OrderAlert>((order) => ({
    orderId: order.id,
    customer: order.customer,
    source: order.source,
    tableNumber: order.tableNumber,
    value: order.value,
    at: Date.now(),
  }))
  setState({ items: [...alerts.reverse(), ...state.items].slice(0, maxItems), unread: state.unread + incoming.length })
  toast.success(incoming.length === 1 ? `Novo pedido #${incoming[0].id} de ${incoming[0].customer}` : `${incoming.length} novos pedidos`)
  if (state.soundOn) playAlertSound()
}

export async function checkNewOrders() {
  const now = Date.now()
  if (now - lastCheck < minCheckGapMs) return
  lastCheck = now
  try {
    processOrders(await fetchOrders())
  } catch {
    // sem rede: tenta de novo no próximo ciclo
  }
}

export function markAlertsRead() {
  if (state.unread > 0) setState({ unread: 0 })
}

export function clearAlerts() {
  setState({ items: [], unread: 0 })
}

export function setAlertSound(on: boolean) {
  try {
    localStorage.setItem(soundKey, on ? 'on' : 'off')
  } catch {
    // preferência só vale nesta sessão
  }
  setState({ soundOn: on })
  if (on) void unlockAudio().then(playAlertSound)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

export function useOrderAlerts() {
  return useSyncExternalStore(subscribe, () => state)
}
