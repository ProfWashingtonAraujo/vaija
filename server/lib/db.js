import { Pool } from 'pg'

const databaseUrl = process.env.DATABASE_URL

if (!databaseUrl) {
  throw new Error('DATABASE_URL is required to start the backend.')
}

export const pool = new Pool({
  connectionString: databaseUrl,
})
