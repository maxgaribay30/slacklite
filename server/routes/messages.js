// server/routes/messages.js
const router = require('express').Router()
const { query } = require('../db')
const { requireAuth } = require('../middleware/auth')

/**
 * GET /api/messages/:roomId
 *
 * Cursor-based pagination using the `seq` BIGSERIAL column.
 *
 * Why cursor pagination instead of OFFSET?
 *   OFFSET 1000 means Postgres scans and discards 1000 rows before returning
 *   results. With millions of messages, this gets slow and inconsistent (new
 *   messages shift the offset). Cursor pagination skips directly to the right
 *   row using the index: WHERE seq < $cursor ORDER BY seq DESC LIMIT 50.
 *   Each page is O(log n) regardless of how deep you are in history.
 *
 * Usage:
 *   GET /api/messages/room123             → latest 50 messages
 *   GET /api/messages/room123?before=8450 → 50 messages before seq 8450
 *
 * The client gets `has_more: true` when there are older messages to load.
 */
router.get('/:roomId', requireAuth, async (req, res) => {
  const { roomId } = req.params
  const limit  = Math.min(parseInt(req.query.limit) || 50, 100)
  const before = req.query.before ? parseInt(req.query.before) : null

  // Verify user is a member of this room
  const membership = await query(
    `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2`,
    [roomId, req.user.id]
  )
  if (!membership.rows.length) {
    return res.status(403).json({ error: 'Not a member of this room' })
  }

  try {
    const params = [roomId, limit + 1] // fetch one extra to determine has_more
    const cursorClause = before ? `AND m.seq < $3` : ''
    if (before) params.push(before)

    const { rows } = await query(`
      SELECT
        m.id, m.seq, m.content, m.created_at,
        u.id       AS user_id,
        u.username AS username,
        u.avatar_color
      FROM messages m
      JOIN users u ON u.id = m.user_id
      WHERE m.room_id = $1 ${cursorClause}
      ORDER BY m.seq DESC
      LIMIT $2
    `, params)

    const has_more = rows.length > limit
    const messages = rows.slice(0, limit).reverse() // return in chronological order

    res.json({
      messages,
      has_more,
      next_cursor: has_more ? messages[0].seq : null,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch messages' })
  }
})

module.exports = router
