import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreHorizontal, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PillTone = 'neutral' | 'accent' | 'ok' | 'warn' | 'bad' | 'info'

const pillTones: Record<PillTone, string> = {
  neutral: 'bg-sa-hover text-sa-text-2',
  accent: 'bg-sa-accent-soft text-sa-accent-text',
  ok: 'bg-sa-ok-soft text-sa-ok',
  warn: 'bg-sa-warn-soft text-sa-warn',
  bad: 'bg-sa-bad-soft text-sa-bad',
  info: 'bg-sa-info-soft text-sa-info',
}

export function Pill({ tone = 'neutral', children, className }: { tone?: PillTone; children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex w-fit items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold', pillTones[tone], className)}>{children}</span>
}

export function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase()
  return <div className={cn('flex shrink-0 items-center justify-center rounded-full bg-sa-accent-soft font-heading font-bold text-sa-accent-text', size === 'lg' ? 'h-14 w-14 text-lg' : 'h-9 w-9 text-xs')}>{initials || '?'}</div>
}

export function EmptyBlock({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-sa-border p-8 text-center">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sa-accent-soft text-sa-accent-text">{icon}</div>
      <p className="text-sm font-semibold text-sa-text-2">{text}</p>
    </div>
  )
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <label className="relative block w-full sm:w-64">
      <span className="sr-only">{placeholder}</span>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-sa-soft" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-10 w-full rounded-xl border border-sa-border bg-sa-surface-2 pl-9 pr-3 text-sm text-sa-text outline-none placeholder:text-sa-soft focus:border-sa-accent" />
    </label>
  )
}

export function FilterPills<T extends string>({ options, value, onChange }: { options: { value: T; label: string; count?: number }[]; value: string; onChange: (value: T) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors', value === option.value ? 'border-sa-accent bg-sa-accent-soft text-sa-accent-text' : 'border-sa-border text-sa-muted hover:text-sa-text')}
        >
          {option.label}{option.count !== undefined ? <span className="ml-1.5 opacity-70">{option.count}</span> : null}
        </button>
      ))}
    </div>
  )
}

export type ActionMenuItem = { label: string; icon?: ReactNode; onClick: () => void; danger?: boolean }

export function ActionMenu({ label, items }: { label: string; items: ActionMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !root.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', close)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', close)
    }
  }, [open])

  return (
    <div ref={root} className="relative">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((current) => !current)} className="flex h-9 w-9 items-center justify-center rounded-lg text-sa-muted transition-colors hover:bg-sa-hover hover:text-sa-text">
        <MoreHorizontal className="h-[18px] w-[18px]" />
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1 w-56 rounded-xl border border-sa-border bg-sa-surface p-1.5 shadow-sa">
          {items.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                item.onClick()
              }}
              className={cn('flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors hover:bg-sa-hover', item.danger ? 'text-sa-bad' : 'text-sa-text-2')}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}

export function IconButton({ label, onClick, danger, children }: { label: string; onClick?: () => void; danger?: boolean; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} onClick={onClick} className={cn('flex h-9 w-9 items-center justify-center rounded-lg transition-colors hover:bg-sa-hover', danger ? 'text-sa-bad' : 'text-sa-muted hover:text-sa-text')}>
      {children}
    </button>
  )
}

export function FormField({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5 text-sm font-semibold text-sa-text-2">
      {label}
      {children}
      {hint ? <span className="text-xs font-normal leading-5 text-sa-muted">{hint}</span> : null}
    </label>
  )
}
