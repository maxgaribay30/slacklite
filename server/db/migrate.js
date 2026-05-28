// server/db/migrate.js
// Run: node db/migrate.js
require('dotenv').config({ path: require('path').join(__dirname, '../.env') })
const { pool } = require('./index')

async function migrate() {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    await client.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`)

    // ── Users ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        username      TEXT        NOT NULL UNIQUE,
        email         TEXT        NOT NULL UNIQUE,
        password_hash TEXT        NOT NULL,
        avatar_color  TEXT        NOT NULL DEFAULT '#6366f1',
        created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // ── Rooms ────────────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS rooms (
        id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        name        TEXT        NOT NULL UNIQUE,
        description TEXT,
        created_by  UUID        REFERENCES users(id),
        created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // ── Room members ─────────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS room_members (
        room_id    UUID NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
        user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        joined_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (room_id, user_id)
      )
    `)

    // ── Messages ─────────────────────────────────────────────────────────────
    // Using a BIGSERIAL for cursor-based pagination — integers are easier to
    // paginate with than UUIDs because they have a natural sort order.
    // cursor = last seen seq value → next page is WHERE seq < $cursor ORDER BY seq DESC LIMIT n
    await client.query(`
      CREATE TABLE IF NOT EXISTS messages (
        id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        seq        BIGSERIAL   NOT NULL,
        room_id    UUID        REFERENCES rooms(id) ON DELETE CASCADE,
        user_id    UUID        NOT NULL REFERENCES users(id),
        content    TEXT        NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // Composite index: all message queries filter by room_id + order by seq DESC
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_messages_room_seq
        ON messages (room_id, seq DESC)
    `)

    // ── Direct messages ──────────────────────────────────────────────────────
    await client.query(`
      CREATE TABLE IF NOT EXISTS direct_messages (
        id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
        seq          BIGSERIAL   NOT NULL,
        from_user_id UUID        NOT NULL REFERENCES users(id),
        to_user_id   UUID        NOT NULL REFERENCES users(id),
        content      TEXT        NOT NULL,
        created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // DM queries look up both directions: (from,to) or (to,from)
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_dm_participants
        ON direct_messages (
          LEAST(from_user_id::TEXT, to_user_id::TEXT),
          GREATEST(from_user_id::TEXT, to_user_id::TEXT),
          seq DESC
        )
    `)

    // ── Presence ─────────────────────────────────────────────────────────────
    // last_seen is updated on every heartbeat. The API considers a user online
    // if NOW() - last_seen < PRESENCE_TTL_SECONDS (default 15s).
    // This is simpler than Redis for small-scale; upgrade to Redis SET with
    // EX (expire) for production multi-instance deployments.
    await client.query(`
      CREATE TABLE IF NOT EXISTS presence (
        user_id    UUID        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        last_seen  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        socket_id  TEXT
      )
    `)

    await client.query('COMMIT')
    console.log('✓ Migration complete')
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('✗ Migration failed:', err.message)
    process.exit(1)
  } finally {
    client.release()
    await pool.end()
  }
}

migrate()
