// client/src/hooks/useMessages.js
import { useState, useEffect, useCallback, useRef } from 'react'
import { api } from '../lib/api'
import { useSocket } from '../context/SocketContext'

/**
 * Custom hook that manages messages for a room.
 *
 * Responsibilities:
 *  1. Fetch the initial page of messages from REST (cursor-based)
 *  2. Listen for new real-time messages via Socket.io
 *  3. Expose loadMore() for infinite scroll upward
 *
 * Why REST for history + WebSocket for new messages?
 *   WebSockets are stateless per connection — if you join a room, you only
 *   get messages sent after you connected. History must come from the DB.
 *   New messages come via WebSocket so you don't need to poll.
 */
export function useMessages(roomId) {
  const [messages, setMessages]   = useState([])
  const [hasMore, setHasMore]     = useState(false)
  const [cursor, setCursor]       = useState(null)
  const [loading, setLoading]     = useState(false)
  const { socket } = useSocket()
  const roomRef = useRef(roomId)

  // Reset and fetch fresh on room change
  useEffect(() => {
    roomRef.current = roomId
    setMessages([])
    setCursor(null)
    setHasMore(false)
    if (!roomId) return
    fetchPage(null, true)
  }, [roomId])

  // Subscribe to real-time new messages for this room
  useEffect(() => {
    if (!socket || !roomId) return

    function onNewMessage(msg) {
      if (msg.room_id !== roomId) return
      setMessages(prev => {
        // Deduplicate — in rare cases the sender might get the message twice
        if (prev.some(m => m.id === msg.id)) return prev
        return [...prev, msg]
      })
    }

    socket.on('message:new', onNewMessage)
    return () => socket.off('message:new', onNewMessage)
  }, [socket, roomId])

  async function fetchPage(beforeCursor, reset = false) {
    setLoading(true)
    try {
      const url = `/api/messages/${roomId}${beforeCursor ? `?before=${beforeCursor}` : ''}`
      const { messages: newMsgs, has_more, next_cursor } = await api.get(url)
      setMessages(prev => reset ? newMsgs : [...newMsgs, ...prev])
      setHasMore(has_more)
      setCursor(next_cursor)
    } catch (err) {
      console.error('Failed to load messages:', err)
    } finally {
      setLoading(false)
    }
  }

  const loadMore = useCallback(() => {
    if (!hasMore || loading || !cursor) return
    fetchPage(cursor)
  }, [hasMore, loading, cursor])

  return { messages, hasMore, loading, loadMore }
}
