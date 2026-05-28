// server/socket/index.js
const { Server } = require('socket.io')
const jwt = require('jsonwebtoken')
const { query } = require('../db')

/**
 * Socket.io architecture overview:
 *
 * Each socket represents one browser tab / connection.
 * Rooms map 1:1 to chat rooms — socket.join(roomId) subscribes the socket
 * to that room's broadcast channel. When a message arrives, we emit to
 * io.to(roomId) which delivers to every socket in that room simultaneously.
 * This is the pub/sub pattern: publisher (sender) → broker (Socket.io) → subscribers (room members).
 *
 * For DMs, I used a deterministic private room name: dm:{sortedId1}:{sortedId2}
 * Both participants join this room on connect, so delivery is symmetric.
 *
 * Presence works via heartbeat:
 *   Client sends 'heartbeat' every 10s → server UPSERTs last_seen = NOW()
 *   On disconnect → last_seen is left as-is; TTL check in queries handles expiry
 *   Any user whose last_seen is older than PRESENCE_TTL_SECONDS is considered offline
 */

function initSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      credentials: true,
    },
  })

  // ── Auth middleware ─────────────────────────────────────────────────────────
  // Runs before every connection. Rejects unauthenticated sockets early.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token
    if (!token) return next(new Error('Authentication required'))

    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET)
      socket.user = { id: payload.sub, username: payload.username }
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', async (socket) => {
    const { id: userId, username } = socket.user
    console.log(`[socket] connected: ${username} (${socket.id})`)

    // ── Mark online ───────────────────────────────────────────────────────────
    await query(
      `INSERT INTO presence (user_id, last_seen, socket_id)
       VALUES ($1, NOW(), $2)
       ON CONFLICT (user_id) DO UPDATE SET last_seen = NOW(), socket_id = $2`,
      [userId, socket.id]
    )

    // Broadcast online status to everyone
    io.emit('presence:update', { userId, isOnline: true })

    // ── Auto-join all rooms the user is a member of ───────────────────────────
    const { rows: memberRooms } = await query(
      `SELECT room_id FROM room_members WHERE user_id = $1`,
      [userId]
    )
    for (const { room_id } of memberRooms) {
      socket.join(room_id)
    }

    // ── Auto-join DM rooms ────────────────────────────────────────────────────
    // Each DM pair shares a deterministic room name so both sides receive messages
    const { rows: dmPartners } = await query(
      `SELECT DISTINCT
         CASE WHEN from_user_id = $1 THEN to_user_id ELSE from_user_id END AS partner_id
       FROM direct_messages WHERE from_user_id = $1 OR to_user_id = $1`,
      [userId]
    )
    for (const { partner_id } of dmPartners) {
      socket.join(dmRoomName(userId, partner_id))
    }

    // ── Room message ──────────────────────────────────────────────────────────
    socket.on('message:send', async ({ roomId, content }) => {
      if (!roomId || !content?.trim()) return

      // Verify membership — never trust the client
      const { rows: mem } = await query(
        `SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2`,
        [roomId, userId]
      )
      if (!mem.length) return socket.emit('error', { message: 'Not a member of this room' })

      try {
        const { rows } = await query(
          `INSERT INTO messages (room_id, user_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, seq, content, created_at`,
          [roomId, userId, content.trim()]
        )
        const msg = {
          ...rows[0],
          user_id: userId,
          username,
          avatar_color: socket.user.avatar_color,
          room_id: roomId,
        }
        // Broadcast to everyone in the room (including sender)
        io.to(roomId).emit('message:new', msg)
      } catch (err) {
        console.error('[socket] message:send error:', err)
        socket.emit('error', { message: 'Failed to send message' })
      }
    })

    // ── Direct message ────────────────────────────────────────────────────────
    socket.on('dm:send', async ({ toUserId, content }) => {
      if (!toUserId || !content?.trim()) return

      try {
        const { rows } = await query(
          `INSERT INTO direct_messages (from_user_id, to_user_id, content)
           VALUES ($1, $2, $3)
           RETURNING id, seq, content, created_at`,
          [userId, toUserId, content.trim()]
        )
        const dm = {
          ...rows[0],
          from_user_id: userId,
          to_user_id: toUserId,
          from_username: username,
          avatar_color: socket.user.avatar_color,
        }
        const room = dmRoomName(userId, toUserId)
        // Make sure both sockets are in the DM room
        socket.join(room)
        const recipientSocket = await findSocketByUserId(io, toUserId)
        if (recipientSocket) recipientSocket.join(room)

        io.to(room).emit('dm:new', dm)
      } catch (err) {
        console.error('[socket] dm:send error:', err)
      }
    })

    // ── Typing indicators ─────────────────────────────────────────────────────
    socket.on('typing:start', ({ roomId }) => {
      socket.to(roomId).emit('typing:update', { userId, username, roomId, isTyping: true })
    })
    socket.on('typing:stop', ({ roomId }) => {
      socket.to(roomId).emit('typing:update', { userId, username, roomId, isTyping: false })
    })

    // ── Join new room (after creating or joining via UI) ──────────────────────
    socket.on('room:join', ({ roomId }) => {
      socket.join(roomId)
    })

    // ── Heartbeat — presence keepalive ────────────────────────────────────────
    // Client sends this every 10s. Server updates last_seen.
    // If last_seen goes stale (no heartbeat), queries return is_online = false.
    socket.on('heartbeat', async () => {
      await query(
        `UPDATE presence SET last_seen = NOW() WHERE user_id = $1`,
        [userId]
      )
    })

    // ── Disconnect ────────────────────────────────────────────────────────────
    socket.on('disconnect', async () => {
      console.log(`[socket] disconnected: ${username}`)
      // We leave last_seen as-is. The TTL check in SQL handles the offline state.
      // This is intentional: if the user reconnects within TTL seconds, they never
      // appeared offline to other users (e.g. page refresh).
      io.emit('presence:update', { userId, isOnline: false })
    })
  })

  return io
}

// Deterministic DM room name — always the same regardless of sender/receiver
function dmRoomName(a, b) {
  return `dm:${[a, b].sort().join(':')}`
}

// Find a connected socket by userId (for DM room joins)
async function findSocketByUserId(io, userId) {
  const sockets = await io.fetchSockets()
  return sockets.find(s => s.user?.id === userId) || null
}

module.exports = { initSocket }
