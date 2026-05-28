// server/db/seed.js
// Run: node db/seed.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const bcrypt = require('bcryptjs')
const { pool } = require('./index')

const COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6']

async function seed() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Seed users
    const users = [
      { username: 'max',    email: 'max@example.com',    color: COLORS[0] },
      { username: 'jordan',  email: 'jordan@example.com',  color: COLORS[1] },
      { username: 'morgan',  email: 'morgan@example.com',  color: COLORS[2] },
      { username: 'taylor',  email: 'taylor@example.com',  color: COLORS[3] },
    ]

    const hash = await bcrypt.hash('password123', 12)
    const userIds = []

    for (const u of users) {
      const { rows } = await client.query(
        `INSERT INTO users (username, email, password_hash, avatar_color)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (email) DO UPDATE SET username = EXCLUDED.username
         RETURNING id`,
        [u.username, u.email, hash, u.color]
      )
      userIds.push(rows[0].id)
    }

    // Seed rooms
    const rooms = [
      { name: 'general',    desc: 'Company-wide announcements and updates' },
      { name: 'engineering', desc: 'Tech talk, code reviews, and architecture' },
      { name: 'random',     desc: 'Non-work banter and watercooler chat' },
    ]

    const roomIds = []
    for (const r of rooms) {
      const { rows } = await client.query(
        `INSERT INTO rooms (name, description, created_by)
         VALUES ($1, $2, $3)
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description
         RETURNING id`,
        [r.name, r.desc, userIds[0]]
      )
      roomIds.push(rows[0].id)
    }

    // Add all users to all rooms
    for (const roomId of roomIds) {
      for (const userId of userIds) {
        await client.query(
          `INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [roomId, userId]
        )
      }
    }

    // Seed messages in #general
    const seedMessages = [
      [userIds[0], roomIds[0], 'Hey everyone, welcome to SlackLite! 👋'],
      [userIds[1], roomIds[0], 'Excited to be here. This UI is clean.'],
      [userIds[2], roomIds[0], 'Just pushed the first commit. Check #engineering for the PR.'],
      [userIds[3], roomIds[0], 'Anyone up for a standup at 10am?'],
      [userIds[0], roomIds[0], 'Sounds good, I\'ll be there.'],
      [userIds[1], roomIds[1], 'Just merged the WebSocket refactor. Cursor pagination is working great.'],
      [userIds[2], roomIds[1], 'Nice work. Did you benchmark it against the old polling approach?'],
      [userIds[1], roomIds[1], 'Yeah — 80% less traffic at 50 concurrent users. WebSockets win.'],
      [userIds[3], roomIds[2], 'Friday = deployed to prod 🚀'],
      [userIds[0], roomIds[2], 'Congrats! What are we shipping?'],
      [userIds[3], roomIds[2], 'Real-time presence indicators. Users can see who\'s online now.'],
    ]

    for (const [userId, roomId, content] of seedMessages) {
      await client.query(
        `INSERT INTO messages (room_id, user_id, content) VALUES ($1, $2, $3)`,
        [roomId, userId, content]
      )
    }

    await client.query('COMMIT')
    console.log('✓ Seed complete')
    console.log('  Test login: max@example.com / password123')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('✗ Seed failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

seed()
