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
      tenantId: payload.tenantId || request.headers['x-tenant-id'] || 'default',
    }
    next()
  } catch {
    response.status(401).json({ ok: false, error: 'invalid_auth_token' })
  }
}

export function requireTenant(request, response, next) {
  const tenantId = request.auth?.tenantId || request.headers['x-tenant-id'] || 'default'

  if (!tenantId || typeof tenantId !== 'string') {
    response.status(400).json({ ok: false, error: 'invalid_tenant_id' })
    return
  }

  request.tenantId = tenantId
  next()
}

export function requireAdmin(request, response, next) {
  if (request.auth?.roleKey !== 'admin') {
    response.status(403).json({ ok: false, error: 'admin_required' })
    return
  }
  next()
}
