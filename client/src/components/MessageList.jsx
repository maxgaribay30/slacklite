// client/src/components/MessageList.jsx
import { useEffect, useRef, useLayoutEffect } from 'react'
import { formatDistanceToNow, format, isToday, isYesterday } from 'date-fns'
import { Avatar } from './Sidebar'

export default function MessageList({ messages, hasMore, loading, onLoadMore }) {
  const bottomRef  = useRef(null)
  const scrollRef  = useRef(null)
  const prevLen    = useRef(0)
  const prevScrollH = useRef(0)

  // Auto-scroll to bottom when new messages arrive at the bottom
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80
    if (messages.length > prevLen.current && atBottom) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
    prevLen.current = messages.length
  }, [messages])

  // Preserve scroll position when loading older messages at the top
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const newScrollH = el.scrollHeight
    if (prevScrollH.current && newScrollH > prevScrollH.current) {
      el.scrollTop = newScrollH - prevScrollH.current
    }
    prevScrollH.current = newScrollH
  }, [messages.length])

  // Infinite scroll: fire onLoadMore when user scrolls near the top
  function handleScroll() {
    if (scrollRef.current?.scrollTop < 80 && hasMore && !loading) {
      prevScrollH.current = scrollRef.current.scrollHeight
      onLoadMore()
    }
  }

  // Group consecutive messages by same author within 5 minutes
  const grouped = groupMessages(messages)

  return (
    <div
      ref={scrollRef}
      onScroll={handleScroll}
      style={{ flex: 1, overflowY: 'auto', padding: '0 0 8px' }}
    >
      {loading && (
        <div style={{ textAlign: 'center', padding: '12px', fontSize: 13, color: 'var(--text-muted)' }}>
          Loading older messages…
        </div>
      )}
      {!hasMore && messages.length > 0 && (
        <div style={{ textAlign: 'center', padding: '24px 0 8px', fontSize: 12, color: 'var(--text-muted)' }}>
          — Beginning of history —
        </div>
      )}
      {grouped.map((group, i) => (
        <MessageGroup key={group[0].id} group={group} />
      ))}
      <div ref={bottomRef} />
    </div>
  )
}

function MessageGroup({ group }) {
  const first = group[0]
  const date = new Date(first.created_at)
  return (
    <div style={{ display: 'flex', gap: 10, padding: '6px 20px', alignItems: 'flex-start' }}
         className="msg-group">
      <Avatar name={first.username} color={first.avatar_color} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 2 }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#fff' }}>{first.username}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }} title={format(date, 'PPpp')}>
            {formatDate(date)}
          </span>
        </div>
        {group.map(msg => (
          <p key={msg.id} style={{ margin: 0, lineHeight: 1.55, color: 'var(--text-primary)', wordBreak: 'break-word' }}>
            {msg.content}
          </p>
        ))}
      </div>
    </div>
  )
}

function formatDate(date) {
  if (isToday(date))     return format(date, 'h:mm a')
  if (isYesterday(date)) return `Yesterday ${format(date, 'h:mm a')}`
  return format(date, 'MMM d, h:mm a')
}

// Group consecutive messages from the same user within 5 minutes
function groupMessages(messages) {
  const groups = []
  for (const msg of messages) {
    const last = groups[groups.length - 1]
    const sameAuthor = last?.[0].user_id === msg.user_id
    const withinWindow = last && (new Date(msg.created_at) - new Date(last[last.length-1].created_at)) < 5 * 60 * 1000
    if (sameAuthor && withinWindow) {
      last.push(msg)
    } else {
      groups.push([msg])
    }
  }
  return groups
}
