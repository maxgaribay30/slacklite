// server/db/index.js
const { Pool } = require('pg')

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Convenience wrapper — use tagged template or parameterized queries only.
// Never interpolate user input directly into SQL strings.
async function query(text, params) {
  const start = Date.now()
  const res = await pool.query(text, params)
  const duration = Date.now() - start
  if (duration > 500) {
    console.warn(`Slow query (${duration}ms):`, text.slice(0, 80))
  }
  return res
}

module.exports = { pool, query }
