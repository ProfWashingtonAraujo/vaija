import { useEffect } from 'react'

export const defaultBrandColor = '#ff6b00'

const shades = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const
// quanto misturar de branco (positivo) ou preto (negativo) para cada tom, partindo da cor da marca no 500
const mix: Record<(typeof shades)[number], number> = { 50: 0.92, 100: 0.84, 200: 0.68, 300: 0.48, 400: 0.24, 500: 0, 600: -0.14, 700: -0.28, 800: -0.42, 900: -0.58 }

export function normalizeHex(value: string | undefined) {
  const match = /^#?([0-9a-f]{6})$/i.exec((value ?? '').trim())
  return match ? `#${match[1].toLowerCase()}` : defaultBrandColor
}

function toRgb(hex: string) {
  const value = parseInt(hex.slice(1), 16)
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255] as const
}

function mixWith(hex: string, amount: number) {
  const target = amount >= 0 ? 255 : 0
  const ratio = Math.abs(amount)
  return `#${toRgb(hex).map((channel) => Math.round(channel + (target - channel) * ratio).toString(16).padStart(2, '0')).join('')}`
}

/** Cor do texto (branco ou escuro) com contraste suficiente sobre a cor da marca. */
export function readableOn(hex: string) {
  const [r, g, b] = toRgb(hex)
  return (r * 299 + g * 587 + b * 114) / 1000 > 170 ? '#1f2937' : '#ffffff'
}

/**
 * O Tailwind v4 expõe as cores como variáveis CSS; sobrescrever a escala "orange" (e a "primary")
 * recolore todo o cliente com a marca da loja, sem mexer em cada componente.
 */
export function buildBrandVars(color: string | undefined) {
  const hex = normalizeHex(color)
  const vars: Record<string, string> = {}
  for (const shade of shades) vars[`--color-orange-${shade}`] = mixWith(hex, mix[shade])
  vars['--color-primary'] = hex
  vars['--color-primary-dark'] = mixWith(hex, -0.2)
  vars['--color-primary-light'] = mixWith(hex, 0.4)
  vars['--color-primary-soft'] = mixWith(hex, 0.8)
  vars['--brand-on-primary'] = readableOn(hex)
  return vars
}

/** Aplica a marca da loja na página inteira (inclui diálogos) e restaura o padrão ao sair. */
export function useBrandTheme(color: string | undefined) {
  useEffect(() => {
    const root = document.documentElement
    const vars = buildBrandVars(color)
    for (const [name, value] of Object.entries(vars)) root.style.setProperty(name, value)
    const themeMeta = document.querySelector('meta[name="theme-color"]')
    const previousTheme = themeMeta?.getAttribute('content')
    themeMeta?.setAttribute('content', normalizeHex(color))
    return () => {
      for (const name of Object.keys(vars)) root.style.removeProperty(name)
      if (previousTheme) themeMeta?.setAttribute('content', previousTheme)
    }
  }, [color])
}
