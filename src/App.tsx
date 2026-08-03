import { AppRoutes } from './routes/app-routes'
import { readSettings } from '@/lib/settings'

const themes: Record<string, React.CSSProperties> = {
  'Light Premium': {
    '--color-background': '#fffdf8',
    '--color-section': '#fffaf5',
    '--color-card-highlight': '#fff4e8',
    '--color-primary': '#ff6b00',
    '--color-primary-dark': '#d94f00',
    '--color-primary-light': '#ffb26b',
    '--color-primary-soft': '#ffe2c2',
    '--color-border-strong': '#fdba74',
  } as React.CSSProperties,
  'Cozinha Noturna': {
    '--color-background': '#0f172a',
    '--color-section': '#111827',
    '--color-card-highlight': '#1e293b',
    '--color-primary': '#f97316',
    '--color-primary-dark': '#c2410c',
    '--color-primary-light': '#fb923c',
    '--color-primary-soft': '#431407',
    '--color-border-strong': '#fb923c',
  } as React.CSSProperties,
  'Delivery Vibrante': {
    '--color-background': '#fff7ed',
    '--color-section': '#ffedd5',
    '--color-card-highlight': '#fed7aa',
    '--color-primary': '#ea580c',
    '--color-primary-dark': '#9a3412',
    '--color-primary-light': '#fdba74',
    '--color-primary-soft': '#ffedd5',
    '--color-border-strong': '#f97316',
  } as React.CSSProperties,
  'Clássico Elegante': {
    '--color-background': '#fafaf9',
    '--color-section': '#f5f5f4',
    '--color-card-highlight': '#e7e5e4',
    '--color-primary': '#92400e',
    '--color-primary-dark': '#78350f',
    '--color-primary-light': '#d6a15d',
    '--color-primary-soft': '#f5eadb',
    '--color-border-strong': '#d6a15d',
  } as React.CSSProperties,
  'Alto Contraste': {
    '--color-background': '#f8fafc',
    '--color-section': '#e2e8f0',
    '--color-card-highlight': '#cbd5e1',
    '--color-primary': '#0f172a',
    '--color-primary-dark': '#020617',
    '--color-primary-light': '#475569',
    '--color-primary-soft': '#e2e8f0',
    '--color-border-strong': '#0f172a',
  } as React.CSSProperties,
}

function App() {
  const settings = readSettings()
  const themeStyle = themes[settings.preferences.theme] ?? themes['Light Premium']

  return <div style={themeStyle}><AppRoutes /></div>
}

export default App
