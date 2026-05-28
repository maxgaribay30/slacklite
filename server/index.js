// server/index.js
require('dotenv').config()
const http = require('http')
const app = require('./app')
const { initSocket } = require('./socket')
const { pool } = require('./db')

const PORT = process.env.PORT || 4000

const server = http.createServer(app)
initSocket(server)

server.listen(PORT, async () => {
  try {
    await pool.query('SELECT 1') // verify DB connection on startup
    console.log(`✓ Database connected`)
    console.log(`✓ Server running on http://localhost:${PORT}`)
  } catch (err) {
    console.error('✗ Database connection failed:', err.message)
    process.exit(1)
  }
})
