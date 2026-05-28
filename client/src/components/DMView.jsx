// client/src/components/DMView.jsx
import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { api } from '../lib/api'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import { Avatar } from './Sidebar'

export default function DMView({ users }) {
  const { userId: otherUserId } = useParams()
  const { user: me } = useAuth()
  const { socket, onlineUsers } = useSocket()
  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore]   = useState(false)
  const [cursor, setCursor]     = useState(null)
  const [loading, setLoading]   = useState(false)
  const prevScrollH = useRef(0)

  const otherUser = users.find(u => u.id === otherUserId)

  // Load initial DM history
  useEffect(() => {
    if (!otherUserId) return
    setMessages([])
    setCursor(null)
    setHasMore(false)
    fetchPage(null, true)
  }, [otherUserId])

  // Listen for incoming DMs
  useEffect(() => {
    if (!socket) return

    function onDM(dm) {
      const isOurs = (dm.from_user_id === me.id && dm.to_user_id === otherUserId) ||
                     (dm.from_user_id === otherUserId && dm.to_user_id === me.id)
      if (!isOurs) return
      setMessages(prev => prev.some(m => m.id === dm.id) ? prev : [...prev, dm])
    }

    socket.on('dm:new', onDM)
    return () => socket.off('dm:new', onDM)
  }, [socket, otherUserId, me.id])

  async function fetchPage(before, reset = false) {
    setLoading(true)
    try {
      const url = `/api/dms/${otherUserId}${before ? `?before=${before}` : ''}`
      const { messages: msgs, has_more, next_cursor } = await api.get(url)
      setMessages(prev => reset ? msgs : [...msgs, ...prev])
      setHasMore(has_more)
      setCursor(next_cursor)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const sendDM = useCallback((content) => {
    if (!socket) return
    socket.emit('dm:send', { toUserId: otherUserId, content })
  }, [socket, otherUserId])

  const loadMore = () => {
    if (!hasMore || loading || !cursor) return
    fetchPage(cursor)
  }

  // Adapt DMs to the same shape MessageList expects
  const adapted = messages.map(m => ({
    ...m,
    user_id: m.from_user_id,
    username: m.from_username || (m.from_user_id === me.id ? me.username : otherUser?.username),
    avatar_color: m.avatar_color,
    room_id: null,
  }))

  const isOnline = onlineUsers.has(otherUserId)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ position: 'relative' }}>
          <Avatar name={otherUser?.username} color={otherUser?.avatar_color} size={32} />
          <div style={{
            position: 'absolute', bottom: -1, right: -1,
            width: 10, height: 10, borderRadius: '50%',
            background: isOnline ? 'var(--online)' : 'var(--text-muted)',
            border: '2px solid var(--bg-surface)',
          }} />
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 15, color: '#fff' }}>{otherUser?.username || '…'}</div>
          <div style={{ fontSize: 12, color: isOnline ? 'var(--online)' : 'var(--text-muted)' }}>
            {isOnline ? 'Active now' : 'Offline'}
          </div>
        </div>
      </div>

      <MessageList
        messages={adapted}
        hasMore={hasMore}
        loading={loading}
        onLoadMore={loadMore}
      />

      <MessageInput
        onSend={sendDM}
        placeholder={`Message ${otherUser?.username || '…'}`}
        typingText={null}
      />
    </div>
  )
}
