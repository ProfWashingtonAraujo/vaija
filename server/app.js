import cors from 'cors'
import cookieParser from 'cookie-parser'
import express from 'express'
import { frontendOrigin } from './lib/env.js'
import { requireAuth } from './middlewares/auth-middleware.js'
import { authRouter } from './routes/auth-routes.js'
import { catalogRouter } from './routes/catalog-routes.js'
import { ordersRouter } from './routes/orders-routes.js'
import { usersRouter } from './routes/users-routes.js'
import printerRouter from './routes/printer-routes.js'

export function createApp() {
  const app = express()

  app.use(cors({
    credentials: true,
    origin(origin, callback) {
      if (!origin) {
        callback(null, true)
        return
      }

      if (!frontendOrigin || origin === frontendOrigin) {
        callback(null, true)
        return
      }

      callback(new Error('Not allowed by CORS'))
    },
  }))
  app.use(cookieParser())
  app.use(express.json())

  app.get('/api/health', (_request, response) => {
    response.json({ ok: true, database: 'postgres' })
  })

  app.use('/api', authRouter)
  app.use('/api', requireAuth, catalogRouter)
  app.use('/api', requireAuth, ordersRouter)
  app.use('/api', requireAuth, usersRouter)
  app.use('/api/printer', requireAuth, printerRouter)

  return app
}
