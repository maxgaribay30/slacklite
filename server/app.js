// server/app.js
const express = require('express')
const cors = require('cors')

const authRoutes    = require('./routes/auth')
const roomRoutes    = require('./routes/rooms')
const messageRoutes = require('./routes/messages')
const dmRoutes      = require('./routes/dms')
const userRoutes    = require('./routes/users')

const app = express()

app.use(cors({ origin: process.env.CLIENT_URL || 'http://localhost:5173', credentials: true }))
app.use(express.json())

app.use('/api/auth',     authRoutes)
app.use('/api/rooms',    roomRoutes)
app.use('/api/messages', messageRoutes)
app.use('/api/dms',      dmRoutes)
app.use('/api/users',    userRoutes)

app.get('/api/health', (_, res) => res.json({ ok: true }))

module.exports = app
