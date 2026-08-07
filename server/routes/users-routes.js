import { Router } from 'express'
import { requirePermission } from '../middlewares/permission-middleware.js'
import { createUserAccount, getAllUsers, updateOwnPassword } from '../services/auth-service.js'

export const usersRouter = Router()

usersRouter.get('/users', requirePermission('users:read'), async (request, response) => {
  const tenantId = request.auth?.tenantId || 'default'
  const users = await getAllUsers(tenantId)
  response.json({ ok: true, users })
})

usersRouter.post('/users', requirePermission('users:create'), async (request, response) => {
  const { name, roleKey, shift, email, password } = request.body ?? {}
  const tenantId = request.auth?.tenantId || 'default'

  if (!name || !roleKey || !shift || !email || !password) {
    response.status(400).json({ ok: false, error: 'missing_user_fields' })
    return
  }

  try {
    const user = await createUserAccount({ name, roleKey, shift, email, password, tenantId })
    response.status(201).json({ ok: true, user })
  } catch (error) {
    response.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'failed_to_create_user' })
  }
})

usersRouter.post('/users/change-password', async (request, response) => {
  const { currentPassword, nextPassword } = request.body ?? {}
  const tenantId = request.auth?.tenantId || 'default'

  if (!currentPassword || !nextPassword) {
    response.status(400).json({ ok: false, error: 'missing_password_fields' })
    return
  }

  try {
    await updateOwnPassword(request.auth.userId, currentPassword, nextPassword, tenantId)
    response.json({ ok: true })
  } catch (error) {
    response.status(400).json({ ok: false, error: error instanceof Error ? error.message : 'failed_to_change_password' })
  }
})
