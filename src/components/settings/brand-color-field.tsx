import { useEffect, useState } from 'react'
import { cmykToHex, defaultBrandColor, hexToCmyk, normalizeHex, type Cmyk } from '@/lib/brand'
import { cn } from '@/lib/utils'

type Mode = 'cmyk' | 'hex'

const inks: { key: keyof Cmyk; label: string }[] = [
  { key: 'c', label: 'C' },
  { key: 'm', label: 'M' },
  { key: 'y', label: 'Y' },
  { key: 'k', label: 'K' },
]

const isHex = (text: string) => /^#?[0-9a-f]{6}$/i.test(text.trim())
const clampInk = (value: string) => Math.min(100, Math.max(0, Math.round(Number(value) || 0)))

/** Cor da marca: seletor de cor mais entrada em CMYK (0 a 100) ou HEX. */
export function BrandColorField({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  const [mode, setMode] = useState<Mode>('cmyk')
  const [cmyk, setCmyk] = useState<Cmyk>(() => hexToCmyk(value))
  const [hexDraft, setHexDraft] = useState(value.toUpperCase())

  // A cor mudou por fora (seletor, "Restaurar padrão"): atualiza os campos sem atrapalhar quem está digitando.
  useEffect(() => {
    setCmyk((current) => (cmykToHex(current) === value ? current : hexToCmyk(value)))
    setHexDraft((draft) => (isHex(draft) && normalizeHex(draft) === value ? draft : value.toUpperCase()))
  }, [value])

  const setInk = (key: keyof Cmyk, raw: string) => {
    const next = { ...cmyk, [key]: raw === '' ? 0 : clampInk(raw) }
    setCmyk(next)
    onChange(cmykToHex(next))
  }

  const fieldClass = 'h-10 rounded-lg border border-sa-border bg-sa-surface-2 px-2 text-center font-mono text-sm text-sa-text outline-none transition focus:border-sa-accent focus:ring-4 focus:ring-sa-accent/20'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="h-10 w-14 cursor-pointer rounded-lg border border-sa-border bg-sa-surface p-1" aria-label="Cor da marca" />
        <div role="tablist" aria-label="Formato da cor" className="inline-flex rounded-lg border border-sa-border bg-sa-surface-2 p-0.5">
          {(['cmyk', 'hex'] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => setMode(item)} className={cn('rounded-md px-3 py-1 text-xs font-semibold uppercase transition', mode === item ? 'bg-sa-surface text-sa-accent-text shadow-sa' : 'text-sa-muted hover:text-sa-text')}>{item}</button>
          ))}
        </div>
        {value !== defaultBrandColor ? <button type="button" className="text-sm font-medium text-sa-text-2 hover:text-sa-text" onClick={() => onChange(defaultBrandColor)}>Restaurar padrão</button> : null}
      </div>

      {mode === 'cmyk' ? (
        <div className="flex flex-wrap items-end gap-2">
          {inks.map(({ key, label }) => (
            <label key={key} className="grid gap-1 text-center text-xs font-semibold text-sa-muted">
              {label}
              <input type="number" inputMode="numeric" min={0} max={100} value={cmyk[key]} onChange={(event) => setInk(key, event.target.value)} className={cn(fieldClass, 'w-16')} aria-label={`${label} em porcentagem`} />
            </label>
          ))}
          <span className="pb-2 text-xs text-sa-soft">% · equivale a <span className="font-mono">{value.toUpperCase()}</span></span>
        </div>
      ) : (
        <input
          value={hexDraft}
          onChange={(event) => {
            setHexDraft(event.target.value)
            if (isHex(event.target.value)) onChange(normalizeHex(event.target.value))
          }}
          maxLength={7}
          placeholder="#FF6B00"
          className={cn(fieldClass, 'w-32 text-left')}
          aria-label="Cor em HEX"
        />
      )}
      <p className="text-xs text-sa-soft">A conversão é aproximada, pensada para a tela. A cor impressa pode variar conforme a gráfica.</p>
    </div>
  )
}
