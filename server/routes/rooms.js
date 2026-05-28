// server/routes/rooms.js
const router = require('express').Router()
const { query } = require('../db')
const { requireAuth } = require('../middleware/auth')

// GET /api/rooms — list all rooms with member count
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        r.id, r.name, r.description, r.created_at,
        COUNT(rm.user_id)::INT AS member_count,
        EXISTS (
          SELECT 1 FROM room_members
          WHERE room_id = r.id AND user_id = $1
        ) AS is_member
      FROM rooms r
      LEFT JOIN room_members rm ON rm.room_id = r.id
      GROUP BY r.id
      ORDER BY r.name
    `, [req.user.id])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch rooms' })
  }
})

// POST /api/rooms — create a room
router.post('/', requireAuth, async (req, res) => {
  const { name, description } = req.body
  if (!name) return res.status(400).json({ error: 'Room name is required' })

  try {
    const { rows } = await query(
      `INSERT INTO rooms (name, description, created_by)
       VALUES ($1, $2, $3) RETURNING *`,
      [name.toLowerCase().replace(/\s+/g, '-'), description, req.user.id]
    )
    // Creator auto-joins
    await query(
      `INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)`,
      [rows[0].id, req.user.id]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Room name already taken' })
    res.status(500).json({ error: 'Failed to create room' })
  }
})

// POST /api/rooms/:id/join
router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    await query(
      `INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id]
    )
    res.json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Failed to join room' })
  }
})

// GET /api/rooms/:id/members
router.get('/:id/members', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT u.id, u.username, u.avatar_color,
             (NOW() - p.last_seen) < INTERVAL '${process.env.PRESENCE_TTL_SECONDS || 15} seconds' AS is_online
      FROM room_members rm
      JOIN users u ON u.id = rm.user_id
      LEFT JOIN presence p ON p.user_id = u.id
      WHERE rm.room_id = $1
      ORDER BY u.username
    `, [req.params.id])
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch members' })
  }
})

module.exports = router
