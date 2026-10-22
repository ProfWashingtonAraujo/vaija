export function SectionHeader({ badge, title, description, align = 'center' }: { badge?: string; title: string; description: string; align?: 'center' | 'left' }) {
  return (
    <div className={align === 'center' ? 'mx-auto max-w-3xl text-center' : 'max-w-2xl'}>
      {badge ? <span className="mb-4 inline-flex rounded-full border border-sa-border bg-sa-accent-soft px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-sa-accent-text md:text-xs">{badge}</span> : null}
      <h2 className="font-heading text-3xl font-extrabold tracking-tight text-sa-text md:text-5xl">{title}</h2>
      <p className="mt-4 text-base leading-8 text-sa-text-2 md:text-lg">{description}</p>
    </div>
  )
}
