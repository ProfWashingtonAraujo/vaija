import type { ReactNode } from 'react'

export function EmptyState({ title, description, icon }: { title: string; description: string; icon?: ReactNode }) {
  return (
    <div className="rounded-[24px] border border-dashed border-orange-200 bg-white/80 p-6 text-center shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
      {icon ? <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl border border-orange-100 bg-orange-50 text-orange-600">{icon}</div> : null}
      <p className="font-heading text-lg font-bold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  )
}
