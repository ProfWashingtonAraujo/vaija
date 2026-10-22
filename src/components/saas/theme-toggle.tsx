import { Moon, Sun } from 'lucide-react'
import type { SaasTheme } from '@/lib/saas-theme'
import { cn } from '@/lib/utils'

const options = [
  { value: 'light', label: 'Modo claro', icon: Sun },
  { value: 'dark', label: 'Modo escuro', icon: Moon },
] as const

export function ThemeToggle({ theme, onChange }: { theme: SaasTheme; onChange: (theme: SaasTheme) => void }) {
  return (
    <div role="radiogroup" aria-label="Tema do painel" className="inline-flex items-center gap-0.5 rounded-full border border-sa-border bg-sa-surface-2 p-1">
      {options.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={theme === value}
          aria-label={label}
          title={label}
          onClick={() => onChange(value)}
          className={cn(
            'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
            theme === value ? 'bg-sa-accent text-white shadow-sm' : 'text-sa-muted hover:text-sa-text',
          )}
        >
          <Icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  )
}
