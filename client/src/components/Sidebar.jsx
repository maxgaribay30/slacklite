// client/src/components/Sidebar.jsx
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { api } from '../lib/api'

export default function Sidebar({ rooms, users, currentUser, connected, onLogout, onRoomCreated }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { onlineUsers } = useSocket()
  const [newRoom, setNewRoom]     = useState('')
  const [showRoomForm, setShowRoomForm] = useState(false)
  const [creating, setCreating]   = useState(false)

  const myRooms = rooms.filter(r => r.is_member)

  async function createRoom(e) {
    e.preventDefault()
    if (!newRoom.trim()) return
    setCreating(true)
    try {
      const room = await api.post('/api/rooms', { name: newRoom.trim() })
      onRoomCreated(room)
      setNewRoom('')
      setShowRoomForm(false)
    } catch (err) {
      alert(err.message)
    } finally {
      setCreating(false)
    }
  }

  const isActive = (path) => location.pathname === path

  return (
    <div style={{
      width: 'var(--sidebar-w)', background: 'var(--bg-sidebar)', display: 'flex',
      flexDirection: 'column', height: '100%', borderRight: '1px solid var(--border)',
      flexShrink: 0, overflow: 'hidden',
    }}>
      {/* Workspace header */}
      <div style={{ padding: '14px 16px 12px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 600, color: '#fff', fontSize: 15 }}>SlackLite</div>
          <div style={{ fontSize: 12, color: connected ? 'var(--online)' : '#666', display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: connected ? 'var(--online)' : '#666' }} />
            {connected ? 'Connected' : 'Reconnecting…'}
          </div>
        </div>
        <button onClick={onLogout} title="Sign out" style={{ color: 'var(--text-muted)', fontSize: 18, padding: 4 }}>⎋</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>

        {/* Channels */}
        <SectionHeader label="Channels" onAdd={() => setShowRoomForm(v => !v)} />

        {showRoomForm && (
          <form onSubmit={createRoom} style={{ padding: '6px 12px 10px' }}>
            <input
              autoFocus value={newRoom} onChange={e => setNewRoom(e.target.value)}
              placeholder="new-channel-name"
              style={{ width: '100%', background: '#1a1d21', border: '1px solid var(--border)', borderRadius: 4, padding: '6px 8px', color: '#fff', fontSize: 13, outline: 'none' }}
            />
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button type="submit" disabled={creating} style={{ flex: 1, padding: '5px', background: 'var(--accent)', color: '#fff', borderRadius: 4, fontSize: 12 }}>
                {creating ? '…' : 'Create'}
              </button>
              <button type="button" onClick={() => setShowRoomForm(false)} style={{ flex: 1, padding: '5px', background: 'var(--bg-hover)', color: 'var(--text-secondary)', borderRadius: 4, fontSize: 12 }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {myRooms.map(room => (
          <NavItem
            key={room.id}
            label={`# ${room.name}`}
            active={isActive(`/room/${room.id}`)}
            onClick={() => navigate(`/room/${room.id}`)}
          />
        ))}

        {/* Direct messages */}
        <SectionHeader label="Direct Messages" style={{ marginTop: 16 }} />

        {users.map(u => (
          <NavItem
            key={u.id}
            label={u.username}
            active={isActive(`/dm/${u.id}`)}
            onClick={() => navigate(`/dm/${u.id}`)}
            prefix={
              <div style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: onlineUsers.has(u.id) ? 'var(--online)' : 'transparent',
                border: onlineUsers.has(u.id) ? 'none' : '1.5px solid var(--text-muted)',
              }} />
            }
          />
        ))}
      </div>

      {/* Current user */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <Avatar name={currentUser?.username} color={currentUser?.avatar_color} size={28} />
        <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{currentUser?.username}</span>
      </div>
    </div>
  )
}

function SectionHeader({ label, onAdd }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', padding: '4px 12px 2px', justifyContent: 'space-between' }}>
      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {onAdd && (
        <button onClick={onAdd} style={{ color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: 2 }}>+</button>
      )}
    </div>
  )
}

function NavItem({ label, active, onClick, prefix }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', textAlign: 'left', padding: '4px 12px', fontSize: 15,
        color: active ? '#fff' : 'var(--text-secondary)',
        background: active ? 'var(--bg-active)' : 'transparent',
        borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8,
        margin: '0 4px', width: 'calc(100% - 8px)',
      }}
    >
      {prefix}
      {label}
    </button>
  )
}

export function Avatar({ name, color, size = 32 }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 6, background: color || '#6366f1',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontWeight: 600, fontSize: size * 0.4, color: '#fff', flexShrink: 0, userSelect: 'none',
    }}>
      {name?.[0]?.toUpperCase() || '?'}
    </div>
  )
}
