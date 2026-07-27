import 'dotenv/config'
import { createApp } from './app.js'
import { backendPort } from './lib/env.js'
import { initializeCatalogTables } from './repositories/products-repository.js'
import { initializeOrdersTable } from './repositories/orders-repository.js'
import { initializeUsersTable } from './repositories/users-repository.js'

const app = createApp()

Promise.all([initializeUsersTable(), initializeOrdersTable(), initializeCatalogTables()])
  .then(() => {
    app.listen(backendPort, () => {
      console.log(`Backend running on http://localhost:${backendPort}`)
    })
  })
  .catch((error) => {
    console.error('Failed to start backend:', error)
    process.exit(1)
  })
