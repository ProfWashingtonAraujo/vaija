import type { ReactNode } from 'react'

export function EmptyState({ title, description, icon }: { title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-sa-border bg-sa-surface p-6 text-center shadow-sa">
      {icon ? <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-sa-border bg-sa-accent-soft text-sa-accent-text">{icon}</div> : null}
      <p className="font-heading text-lg font-bold text-sa-text">{title}</p>
      <p className="mt-2 text-sm leading-6 text-sa-muted">{description}</p>
    </div>
  )
}
