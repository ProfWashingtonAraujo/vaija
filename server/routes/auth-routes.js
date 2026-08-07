import { Router } from 'express'
import { clearAuthCookies, setAuthCookies } from '../lib/cookies.js'
import { requireAuth } from '../middlewares/auth-middleware.js'
import { getAuthenticatedUser, loginWithEmailAndPassword, logoutSession, refreshSession } from '../services/auth-service.js'

export const authRouter = Router()

authRouter.post('/auth/login', async (request, response) => {
  const email = String(request.body?.email ?? '')
  const password = String(request.body?.password ?? '')
  const tenantId = request.headers['x-tenant-id'] || request.body?.tenantId || 'default'

  if (!email || !password) {
    response.status(400).json({ ok: false, error: 'missing_credentials' })
    return
  }

  const session = await loginWithEmailAndPassword(email, password, tenantId)
  if (!session) {
    response.status(401).json({ ok: false, error: 'invalid_credentials' })
    return
  }

  setAuthCookies(response, session.accessToken, session.refreshToken)
  response.json({ ok: true, user: session.user, tenantId: session.tenantId })
})

authRouter.post('/auth/refresh', async (request, response) => {
  const refreshToken = request.cookies?.vaija_refresh_token
  if (!refreshToken) {
    response.status(401).json({ ok: false, error: 'missing_refresh_token' })
    return
  }

  const session = await refreshSession(refreshToken)
  if (!session) {
    clearAuthCookies(response)
    response.status(401).json({ ok: false, error: 'invalid_refresh_token' })
    return
  }

  setAuthCookies(response, session.accessToken, session.refreshToken)
  response.json({ ok: true, user: session.user, tenantId: session.tenantId })
})

authRouter.post('/auth/logout', async (request, response) => {
  await logoutSession(request.cookies?.vaija_refresh_token)
  clearAuthCookies(response)
  response.json({ ok: true })
})

authRouter.get('/auth/me', requireAuth, async (request, response) => {
  const tenantId = request.auth?.tenantId || 'default'
  const user = await getAuthenticatedUser(request.auth.userId, tenantId)

  if (!user) {
    response.status(404).json({ ok: false, error: 'user_not_found' })
    return
  }

  response.json({ ok: true, user, tenantId })
})
