import { useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import type { Order } from '@/data/mock-orders'
import { OrderCard } from '@/components/orders/order-card'

export type BoardColumn = 'Pendente' | 'Em Produção' | 'Pronto/Retirada'

export type DragState = {
  order: Order
  x: number
  y: number
  w: number
  h: number
  tilt: number
  /** Coluna e posição (cartão que vem depois) onde o espaço pontilhado está agora. */
  col: BoardColumn
  beforeId: number | null
  settling: { x: number; y: number } | null
}

type Session = {
  order: Order
  pid: number
  mouse: boolean
  x0: number
  y0: number
  px: number
  py: number
  offX: number
  offY: number
  w: number
  h: number
  col0: BoardColumn
  next0: number | null
  on: boolean
  hold: number | null
  vx: number
  lx: number
  lt: number
  raf: number | null
}

const clampTilt = (vx: number) => Math.max(-9, Math.min(9, 2.5 + vx * 7))

type Controller = {
  down: (order: Order, column: BoardColumn, event: ReactPointerEvent<HTMLElement>) => void
  finish: () => void
  dispose: () => void
  shouldIgnoreClick: () => boolean
}

function createController(
  setDrag: (next: DragState | null) => void,
  columnsRef: { current: Record<BoardColumn, Order[]> },
  onMoveRef: { current: (orderId: number, column: BoardColumn, beforeId?: number) => void },
): Controller {
  let session: Session | null = null
  let current: DragState | null = null
  let suppressClickUntil = 0

  const publish = (next: DragState | null) => {
    current = next
    setDrag(next)
  }

  const locate = (s: Session): { col: BoardColumn; beforeId: number | null } => {
    let best: HTMLElement | null = null
    let bestDistance = Infinity
    document.querySelectorAll<HTMLElement>('[data-board-col]').forEach((el) => {
      const rect = el.getBoundingClientRect()
      const distance = s.px < rect.left ? rect.left - s.px : s.px > rect.right ? s.px - rect.right : 0
      if (distance < bestDistance) {
        bestDistance = distance
        best = el
      }
    })
    const column = best as HTMLElement | null
    if (!column) return { col: current?.col ?? s.col0, beforeId: current?.beforeId ?? null }

    const centerY = s.py - s.offY + s.h / 2
    let beforeId: number | null = null
    for (const card of Array.from(column.querySelectorAll<HTMLElement>('[data-order-id]'))) {
      const rect = card.getBoundingClientRect()
      if (centerY < rect.top + rect.height / 2) {
        beforeId = Number(card.dataset.orderId)
        break
      }
    }
    return { col: column.dataset.boardCol as BoardColumn, beforeId }
  }

  const frame = () => {
    const s = session
    if (!s?.on) return
    const now = performance.now()
    s.vx = s.vx * 0.6 + ((s.px - s.lx) / Math.max(8, now - s.lt)) * 0.4
    s.lx = s.px
    s.lt = now
    if (Math.abs(s.vx) > 0.005) s.vx *= 0.85

    // rolagem automática perto das bordas da tela
    const bottom = window.innerHeight - 64
    const scroll = s.py < 96 ? -(1 - Math.max(0, s.py) / 96) : s.py > bottom ? Math.min(1, (s.py - bottom) / (window.innerHeight - bottom)) : 0
    if (scroll) window.scrollBy(0, scroll * 18)

    const target = locate(s)
    if (current && !current.settling) publish({ ...current, x: s.px - s.offX, y: s.py - s.offY, tilt: clampTilt(s.vx), col: target.col, beforeId: target.beforeId })
    s.raf = requestAnimationFrame(frame)
  }

  const blockScroll = (event: TouchEvent) => {
    if (session?.on) event.preventDefault()
  }

  const detach = () => {
    if (session?.hold != null) window.clearTimeout(session.hold)
    if (session?.raf != null) cancelAnimationFrame(session.raf)
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', up)
    window.removeEventListener('pointercancel', up)
    window.removeEventListener('touchmove', blockScroll)
    document.documentElement.classList.remove('order-dragging')
  }

  const activate = () => {
    const s = session
    if (!s || s.on) return
    s.on = true
    s.lx = s.px
    s.lt = performance.now()
    document.documentElement.classList.add('order-dragging')
    publish({ order: s.order, x: s.px - s.offX, y: s.py - s.offY, w: s.w, h: s.h, tilt: 2.5, col: s.col0, beforeId: s.next0, settling: null })
    s.raf = requestAnimationFrame(frame)
  }

  function move(event: PointerEvent) {
    const s = session
    if (!s || event.pointerId !== s.pid) return
    s.px = event.clientX
    s.py = event.clientY
    if (!s.on) {
      const distance = Math.hypot(s.px - s.x0, s.py - s.y0)
      if (s.mouse && distance > 5) activate()
      else if (!s.mouse && distance > 10) {
        detach()
        session = null
      }
    }
  }

  function up(event: PointerEvent) {
    const s = session
    if (!s || event.pointerId !== s.pid) return
    detach()
    if (!s.on) {
      session = null
      return
    }
    suppressClickUntil = performance.now() + 450
    const slot = document.querySelector<HTMLElement>('[data-order-slot]')
    if (!current || !slot) {
      session = null
      publish(null)
      return
    }
    const rect = slot.getBoundingClientRect()
    publish({ ...current, tilt: 0, settling: { x: rect.left, y: rect.top } })
  }

  return {
    down(order, column, event) {
      if (session || (event.pointerType === 'mouse' && event.button !== 0)) return
      const rect = event.currentTarget.getBoundingClientRect()
      const list = columnsRef.current[column]
      const index = list.findIndex((item) => item.id === order.id)
      const mouse = event.pointerType === 'mouse'
      session = {
        order,
        pid: event.pointerId,
        mouse,
        x0: event.clientX,
        y0: event.clientY,
        px: event.clientX,
        py: event.clientY,
        offX: event.clientX - rect.left,
        offY: event.clientY - rect.top,
        w: rect.width,
        h: rect.height,
        col0: column,
        next0: list[index + 1]?.id ?? null,
        on: false,
        hold: null,
        vx: 0,
        lx: event.clientX,
        lt: performance.now(),
        raf: null,
      }
      // toque: segura ~0,28s para levantar o cartão (senão é rolagem da página)
      if (!mouse) session.hold = window.setTimeout(activate, 280)
      window.addEventListener('pointermove', move, { passive: true })
      window.addEventListener('pointerup', up)
      window.addEventListener('pointercancel', up)
      window.addEventListener('touchmove', blockScroll, { passive: false })
    },
    finish() {
      const s = session
      const last = current
      session = null
      publish(null)
      if (!s || !last) return
      const unchanged = last.col === s.col0 && last.beforeId === s.next0
      if (!unchanged) onMoveRef.current(s.order.id, last.col, last.beforeId ?? undefined)
    },
    dispose() {
      detach()
      session = null
    },
    shouldIgnoreClick: () => performance.now() < suppressClickUntil,
  }
}

/**
 * Arraste por ponteiro do quadro de pedidos: o cartão é "levantado" (inclina conforme a
 * velocidade), um espaço pontilhado marca o destino e os vizinhos deslizam para abrir lugar.
 */
export function useOrderDrag(columns: Record<BoardColumn, Order[]>, onMove: (orderId: number, column: BoardColumn, beforeId?: number) => void) {
  const [drag, setDrag] = useState<DragState | null>(null)
  const columnsRef = useRef(columns)
  const onMoveRef = useRef(onMove)
  const controller = useRef<Controller | null>(null)

  useEffect(() => {
    columnsRef.current = columns
    onMoveRef.current = onMove
  })

  if (!controller.current) controller.current = createController(setDrag, columnsRef, onMoveRef)

  useEffect(() => {
    const instance = controller.current
    return () => instance?.dispose()
  }, [])

  return {
    drag,
    onCardPointerDown: controller.current.down,
    /** Evita que o clique que encerra o arraste abra o painel do pedido. */
    shouldIgnoreClick: controller.current.shouldIgnoreClick,
    finishSettle: controller.current.finish,
  }
}

/** Cartão levantado: segue o ponteiro e, ao soltar, desliza até o espaço pontilhado. */
export function DragLayer({ drag, onSettled }: { drag: DragState | null; onSettled: () => void }) {
  if (!drag) return null
  const settling = drag.settling !== null

  return createPortal(
    <motion.div
      className="pointer-events-none fixed z-[100] cursor-grabbing"
      style={{ width: drag.w, left: 0, top: 0 }}
      initial={false}
      animate={{ x: settling ? drag.settling!.x : drag.x, y: settling ? drag.settling!.y : drag.y, rotate: drag.tilt, scale: settling ? 1 : 1.045 }}
      transition={
        settling
          ? { type: 'tween', duration: 0.4, ease: [0.22, 1, 0.36, 1] }
          : { x: { duration: 0 }, y: { duration: 0 }, rotate: { type: 'tween', duration: 0.45, ease: 'easeOut' }, scale: { type: 'spring', stiffness: 400, damping: 18 } }
      }
      onAnimationComplete={() => {
        if (settling) onSettled()
      }}
    >
      <div className="rounded-2xl shadow-[0_30px_46px_-20px_var(--sa-accent),0_18px_40px_rgba(0,0,0,0.35)]">
        <OrderCard order={drag.order} locked onClick={() => undefined} />
      </div>
    </motion.div>,
    document.body,
  )
}
