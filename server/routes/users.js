// server/routes/users.js
const router = require('express').Router()
const { query } = require('../db')
const { requireAuth } = require('../middleware/auth')

// GET /api/users — all users with online status (for DM sidebar)
router.get('/', requireAuth, async (req, res) => {
  try {
    const ttl = process.env.PRESENCE_TTL_SECONDS || 15
    const { rows } = await query(`
      SELECT
        u.id, u.username, u.avatar_color,
        (NOW() - p.last_seen) < INTERVAL '${ttl} seconds' AS is_online
      FROM users u
      LEFT JOIN presence p ON p.user_id = u.id
      WHERE u.id != $1
      ORDER BY is_online DESC NULLS LAST, u.username
    `, [req.user.id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch users' })
  }
})

module.exports = router
