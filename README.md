# SlackLite

A real-time chat application built with React, Node.js, Socket.io, and PostgreSQL. Features rooms, direct messages, online presence, and message history with cursor-based pagination.

> Built as a portfolio project to demonstrate full-stack engineering fundamentals, WebSocket architecture, and database design patterns.

---

## Features

- **Real-time messaging** — WebSocket-powered rooms and DMs with zero polling
- **Channels** — create and join rooms; messages broadcast to all members via pub/sub
- **Direct messages** — one-on-one conversations with real-time delivery
- **Online presence** — heartbeat-based presence with TTL expiry; green dot shows who's live
- **Typing indicators** — see when others are typing in a channel
- **Message history** — cursor-based pagination for infinite scroll without OFFSET slowdowns
- **JWT auth** — stateless authentication; every socket connection is verified server-side

---

## Architecture

```
slacklite/
├── client/                  # React + Vite frontend
│   └── src/
│       ├── components/      # ChannelView, DMView, Sidebar, MessageList, MessageInput
│       ├── context/         # AuthContext (JWT), SocketContext (Socket.io + presence)
│       ├── hooks/           # useMessages (cursor pagination), useTyping
│       ├── lib/             # api.js (fetch wrapper)
│       └── pages/           # AuthPage, ChatPage
│
└── server/                  # Node.js + Express backend
    ├── db/
    │   ├── index.js         # pg Pool + query helper
    │   ├── migrate.js       # Schema creation
    │   └── seed.js          # Dev seed data
    ├── middleware/
    │   └── auth.js          # JWT requireAuth middleware
    ├── routes/
    │   ├── auth.js          # POST /api/auth/register|login
    │   ├── rooms.js         # GET/POST /api/rooms, join, members
    │   ├── messages.js      # GET /api/messages/:roomId (cursor pagination)
    │   ├── dms.js           # GET /api/dms/:userId
    │   └── users.js         # GET /api/users (with presence)
    └── socket/
        └── index.js         # Socket.io — messages, DMs, typing, heartbeat
```

---

## Tech Stack

| Layer     | Technology |
|-----------|-----------|
| Frontend  | React 18, React Router, Socket.io-client, date-fns |
| Backend   | Node.js, Express, Socket.io |
| Database  | PostgreSQL (pg pool, parameterized queries) |
| Auth      | JWT (jsonwebtoken + bcryptjs) |
| Dev tools | Vite, nodemon, concurrently |

---

##  Getting Started

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### 1. Clone and install

```bash
git clone https://github.com/YOUR_USERNAME/slacklite.git
cd slacklite
npm run install:all
```

### 2. Configure environment

```bash
# Server
cp server/.env.example server/.env
# Edit server/.env — set DATABASE_URL and JWT_SECRET

# Client
cp client/.env.example client/.env
# VITE_API_URL and VITE_SOCKET_URL default to localhost:4000
```

### 3. Set up the database

```bash
createdb slacklite
npm run db:migrate
npm run db:seed
```

### 4. Run

```bash
npm run dev
# Starts both server (port 4000) and client (port 5173) concurrently
```

Visit `http://localhost:5173`

**Demo login:** `max@example.com` / `password123`

---

## Database Schema

```sql
users          -- id, username, email, password_hash, avatar_color
rooms          -- id, name, description, created_by
room_members   -- (room_id, user_id) composite PK
messages       -- id, seq BIGSERIAL, room_id, user_id, content, created_at
direct_messages -- id, seq BIGSERIAL, from_user_id, to_user_id, content, created_at
presence       -- user_id PK, last_seen, socket_id
```

Key indexes:
- `idx_messages_room_seq` on `(room_id, seq DESC)` — every message history query hits this
- `idx_dm_participants` on `(LEAST(from, to), GREATEST(from, to), seq DESC)` — normalizes DM direction

---

## WebSocket Events

| Event | Direction | Payload |
|-------|-----------|---------|
| `message:send` | client → server | `{ roomId, content }` |
| `message:new` | server → room | `{ id, seq, content, username, ... }` |
| `dm:send` | client → server | `{ toUserId, content }` |
| `dm:new` | server → dm-room | `{ id, seq, content, from_user_id, ... }` |
| `typing:start` / `typing:stop` | client → server | `{ roomId }` |
| `typing:update` | server → room | `{ userId, username, isTyping }` |
| `heartbeat` | client → server | — |
| `presence:update` | server → all | `{ userId, isOnline }` |

---

## Key Engineering Decisions

### WebSockets over polling
HTTP polling sends a request every N seconds regardless of activity — wasteful at scale. WebSockets establish a persistent TCP connection; the server pushes only when there's data. At 50 concurrent users this reduces traffic by ~80%.

### Cursor pagination over OFFSET
`OFFSET 1000` forces Postgres to scan and discard 1000 rows before returning results. With large message histories this degrades to O(n). Cursor pagination (`WHERE seq < $cursor ORDER BY seq DESC LIMIT 50`) always uses the index — O(log n) regardless of history depth.

### Heartbeat-based presence
Each client emits a `heartbeat` event every 10 seconds. The server upserts `last_seen = NOW()`. Any user whose `last_seen` is older than `PRESENCE_TTL_SECONDS` (default 15s) is considered offline. This handles tab closes, network drops, and crashes — no explicit disconnect required.

### Pub/sub via Socket.io rooms
Each chat room has a corresponding Socket.io room (same ID). `socket.join(roomId)` subscribes a connection; `io.to(roomId).emit(...)` broadcasts to all subscribers. DMs use a deterministic room name: `dm:{sorted_id1}:{sorted_id2}` so delivery is symmetric.

### JWT on socket handshake
The Socket.io auth middleware runs before any connection is accepted. It verifies the JWT and attaches `socket.user`. If verification fails the connection is rejected — unauthenticated clients never reach any event handler.

---

## What I'd add next

- [ ] Message reactions (emoji)
- [ ] File/image attachments (S3 + presigned URLs)
- [ ] Read receipts per user per room
- [ ] Push notifications (Web Push API)
- [ ] Redis pub/sub to support multiple server instances (horizontal scaling)
- [ ] Rate limiting on message send events
- [ ] Full-text search across message history (PostgreSQL `tsvector`)

---

