export const backendPort = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 3001)
export const authJwtSecret = process.env.AUTH_JWT_SECRET ?? 'vaija-dev-secret'
export const authRefreshDays = Number(process.env.AUTH_REFRESH_DAYS ?? 7)
export const authCookieSecure = process.env.AUTH_COOKIE_SECURE === 'true'

export const allowedOrderStatuses = new Set([
  'Pendente',
  'Em preparo',
  'Em producao',
  'Saiu para entrega',
  'Entregue',
  'Cancelado',
  'Pronto para retirada',
])
