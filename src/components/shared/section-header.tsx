export function SectionHeader({ badge, title, description, align = 'center' }: { badge?: string; title: string; description: string; align?: 'center' | 'left' }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}>
      {badge ? <span className="mb-4 inline-flex rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-orange-700 md:text-xs">{badge}</span> : null}
      <h2 className="font-heading text-3xl font-extrabold tracking-tight text-slate-900 md:text-5xl">{title}</h2>
      <p className="mt-4 text-base leading-8 text-slate-600 md:text-lg">{description}</p>
    </div>
  )
}
