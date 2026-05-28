// client/src/components/ChannelView.jsx
import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useSocket } from '../context/SocketContext'
import { useMessages } from '../hooks/useMessages'
import { useTyping } from '../hooks/useTyping'
import { api } from '../lib/api'
import MessageList from './MessageList'
import MessageInput from './MessageInput'
import { Avatar } from './Sidebar'

export default function ChannelView({ rooms }) {
  const { roomId } = useParams()
  const { socket, onlineUsers } = useSocket()
  const { messages, hasMore, loading, loadMore } = useMessages(roomId)
  const { typingText, onKeystroke, stopTyping } = useTyping(roomId)
  const [members, setMembers] = useState([])
  const [showMembers, setShowMembers] = useState(true)

  const room = rooms.find(r => r.id === roomId)

  useEffect(() => {
    if (!roomId) return
    api.get(`/api/rooms/${roomId}/members`).then(setMembers).catch(console.error)
  }, [roomId])

  const sendMessage = useCallback(async (content) => {
    if (!socket) return
    stopTyping()
    socket.emit('message:send', { roomId, content })
  }, [socket, roomId, stopTyping])

  if (!roomId) return null

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Main channel */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-surface)' }}>
          <div>
            <span style={{ fontWeight: 600, fontSize: 16, color: '#fff' }}># {room?.name || '…'}</span>
            {room?.description && (
              <span style={{ marginLeft: 12, fontSize: 13, color: 'var(--text-muted)' }}>{room.description}</span>
            )}
          </div>
          <button
            onClick={() => setShowMembers(v => !v)}
            style={{ fontSize: 13, color: showMembers ? 'var(--text-primary)' : 'var(--text-muted)', padding: '4px 10px', background: showMembers ? 'var(--bg-hover)' : 'none', borderRadius: 4 }}
          >
            👥 {members.length}
          </button>
        </div>

        <MessageList
          messages={messages}
          hasMore={hasMore}
          loading={loading}
          onLoadMore={loadMore}
        />

        <MessageInput
          onSend={sendMessage}
          placeholder={`Message #${room?.name || '…'}`}
          typingText={typingText}
          onKeystroke={onKeystroke}
        />
      </div>

      {/* Member sidebar */}
      {showMembers && (
        <div style={{ width: 220, borderLeft: '1px solid var(--border)', background: 'var(--bg-sidebar)', padding: '16px 0', overflowY: 'auto', flexShrink: 0 }}>
          <div style={{ padding: '0 16px 8px', fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Members — {members.length}
          </div>
          {members.map(m => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 16px' }}>
              <div style={{ position: 'relative' }}>
                <Avatar name={m.username} color={m.avatar_color} size={28} />
                <div style={{
                  position: 'absolute', bottom: -1, right: -1,
                  width: 9, height: 9, borderRadius: '50%',
                  background: onlineUsers.has(m.id) || m.is_online ? 'var(--online)' : 'var(--bg-hover)',
                  border: '1.5px solid var(--bg-sidebar)',
                }} />
              </div>
              <span style={{ fontSize: 14, color: onlineUsers.has(m.id) ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {m.username}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
