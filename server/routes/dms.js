// server/routes/dms.js
const router = require('express').Router()
const { query } = require('../db')
const { requireAuth } = require('../middleware/auth')

/**
 * GET /api/dms/:userId
 * Fetch conversation history between the current user and :userId.
 *
 * The LEAST/GREATEST trick normalizes the participant order so we can
 * use a single index regardless of who sent vs received:
 *   (user_a, user_b) and (user_b, user_a) both map to
 *   (LEAST, GREATEST) → same index entry.
 */
router.get('/:userId', requireAuth, async (req, res) => {
  const otherUserId = req.params.userId
  const limit  = Math.min(parseInt(req.query.limit) || 50, 100)
  const before = req.query.before ? parseInt(req.query.before) : null

  try {
    const params = [req.user.id, otherUserId, limit + 1]
    const cursorClause = before ? `AND seq < $4` : ''
    if (before) params.push(before)

    const { rows } = await query(`
      SELECT
        dm.id, dm.seq, dm.content, dm.created_at,
        dm.from_user_id, dm.to_user_id,
        u.username AS from_username,
        u.avatar_color
      FROM direct_messages dm
      JOIN users u ON u.id = dm.from_user_id
      WHERE (
        (dm.from_user_id = $1 AND dm.to_user_id = $2) OR
        (dm.from_user_id = $2 AND dm.to_user_id = $1)
      ) ${cursorClause}
      ORDER BY dm.seq DESC
      LIMIT $3
    `, params)

    const has_more = rows.length > limit
    const messages = rows.slice(0, limit).reverse()

    res.json({ messages, has_more, next_cursor: has_more ? messages[0].seq : null })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch DMs' })
  }
})

// GET /api/dms — list recent DM conversations for the sidebar
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await query(`
      SELECT DISTINCT ON (other_user_id)
        other_user_id,
        u.username,
        u.avatar_color,
        last_message,
        last_at,
        (NOW() - p.last_seen) < INTERVAL '${process.env.PRESENCE_TTL_SECONDS || 15} seconds' AS is_online
      FROM (
        SELECT
          CASE WHEN from_user_id = $1 THEN to_user_id ELSE from_user_id END AS other_user_id,
          content AS last_message,
          created_at AS last_at
        FROM direct_messages
        WHERE from_user_id = $1 OR to_user_id = $1
        ORDER BY created_at DESC
      ) sub
      JOIN users u ON u.id = other_user_id
      LEFT JOIN presence p ON p.user_id = other_user_id
      ORDER BY other_user_id, last_at DESC
    `, [req.user.id])
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to fetch DM list' })
  }
})

module.exports = router
