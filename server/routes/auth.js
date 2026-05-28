// server/routes/auth.js
const router  = require('express').Router()
const bcrypt  = require('bcryptjs')
const jwt     = require('jsonwebtoken')
const { query } = require('../db')

function makeToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  )
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'username, email and password are required' })
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' })
  }

  try {
    const hash = await bcrypt.hash(password, 12)
    const colors = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6']
    const color  = colors[Math.floor(Math.random() * colors.length)]

    const { rows } = await query(
      `INSERT INTO users (username, email, password_hash, avatar_color)
       VALUES ($1, $2, $3, $4) RETURNING id, username, email, avatar_color`,
      [username.toLowerCase(), email.toLowerCase(), hash, color]
    )

    // Auto-join #general on register
    await query(
      `INSERT INTO room_members (room_id, user_id)
       SELECT id, $1 FROM rooms WHERE name = 'general' ON CONFLICT DO NOTHING`,
      [rows[0].id]
    )

    res.status(201).json({ token: makeToken(rows[0]), user: rows[0] })
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Username or email already taken' })
    }
    console.error(err)
    res.status(500).json({ error: 'Registration failed' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' })
  }

  try {
    const { rows } = await query(
      `SELECT id, username, email, avatar_color, password_hash FROM users WHERE email = $1`,
      [email.toLowerCase()]
    )
    const user = rows[0]

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' })
    }

    const { password_hash, ...safeUser } = user
    res.json({ token: makeToken(safeUser), user: safeUser })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed' })
  }
})

module.exports = router
