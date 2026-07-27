import jwt from 'jsonwebtoken'
import { authJwtSecret } from '../lib/env.js'

export function requireAuth(request, response, next) {
  const authorization = request.headers.authorization
  const token = request.cookies?.vaija_access_token ?? (authorization?.startsWith('Bearer ') ? authorization.slice('Bearer '.length) : null)

  if (!token) {
    response.status(401).json({ ok: false, error: 'missing_auth_token' })
    return
  }

  try {
    const payload = jwt.verify(token, authJwtSecret)
    request.auth = {
      userId: Number(payload.sub),
      email: payload.email,
      role: payload.role,
      roleKey: payload.roleKey,
    }
    next()
  } catch {
    response.status(401).json({ ok: false, error: 'invalid_auth_token' })
  }
}
