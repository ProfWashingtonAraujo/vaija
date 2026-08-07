import 'dotenv/config'
import { createServer } from 'http'
import { createApp } from './app.js'
import { backendPort } from './lib/env.js'
import { initializeCatalogTables } from './repositories/products-repository.js'
import { initializeOrdersTable } from './repositories/orders-repository.js'
import { initializeUsersTable } from './repositories/users-repository.js'
import { initWebSocket } from './lib/websocket.js'
import { getPrintQueue } from './lib/queue.js'

const app = createApp()
const server = createServer(app)

initWebSocket(server)

try {
  const queue = getPrintQueue()
  console.log('Print queue connected to Redis')
} catch (error) {
  console.warn('Redis not available, print queue will use in-memory fallback')
}

Promise.all([initializeUsersTable(), initializeOrdersTable(), initializeCatalogTables()])
  .then(() => {
    server.listen(backendPort, () => {
      console.log(`Backend running on http://localhost:${backendPort}`)
      console.log(`WebSocket server ready`)
    })
  })
  .catch((error) => {
    console.error('Failed to start backend:', error)
    process.exit(1)
  })
