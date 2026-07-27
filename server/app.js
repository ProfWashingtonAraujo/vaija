import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { requireAuth } from './middlewares/auth-middleware.js'
import { authRouter } from './routes/auth-routes.js'
import { catalogRouter } from './routes/catalog-routes.js'
import { ordersRouter } from './routes/orders-routes.js'
import { usersRouter } from './routes/users-routes.js'

export function createApp() {
  const app = express()

  app.use(cors({ credentials: true, origin: true }))
  app.use(cookieParser())
  app.use(express.json())

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, database: 'postgres' })
  })

  app.use('/api', authRouter)
  app.use('/api', requireAuth, catalogRouter)
  app.use('/api', requireAuth, ordersRouter)
  app.use('/api', requireAuth, usersRouter)

  return app
}
