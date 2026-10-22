export function UserAvatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sa-border bg-sa-accent-soft font-heading font-bold text-sa-accent-text">
      {initials}
    </div>
  )
}
