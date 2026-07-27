import { hasPermission } from '../lib/permissions.js'

export function requirePermission(permission) {
  return (request, response, next) => {
    if (!request.auth || !hasPermission(request.auth.roleKey, permission)) {
      response.status(403).json({ ok: false, error: 'forbidden' })
      return
    }

    next()
  }
}
