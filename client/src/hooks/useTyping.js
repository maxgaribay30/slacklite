// client/src/hooks/useTyping.js
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSocket } from '../context/SocketContext'
import { useAuth } from '../context/AuthContext'

export function useTyping(roomId) {
  const { socket } = useSocket()
  const { user } = useAuth()
  const [typers, setTypers] = useState([])     // [{userId, username}]
  const isTypingRef = useRef(false)
  const stopTimer = useRef(null)

  // Listen for typing events in this room
  useEffect(() => {
    if (!socket || !roomId) return

    function onTyping({ userId, username, roomId: rid, isTyping }) {
      if (rid !== roomId || userId === user?.id) return
      setTypers(prev =>
        isTyping
          ? prev.some(t => t.userId === userId) ? prev : [...prev, { userId, username }]
          : prev.filter(t => t.userId !== userId)
      )
    }

    socket.on('typing:update', onTyping)
    return () => socket.off('typing:update', onTyping)
  }, [socket, roomId, user?.id])

  // Call this on every keystroke in the message input
  const onKeystroke = useCallback(() => {
    if (!socket || !roomId) return

    if (!isTypingRef.current) {
      isTypingRef.current = true
      socket.emit('typing:start', { roomId })
    }

    // Auto-stop typing after 2s of inactivity
    clearTimeout(stopTimer.current)
    stopTimer.current = setTimeout(() => {
      isTypingRef.current = false
      socket.emit('typing:stop', { roomId })
    }, 2000)
  }, [socket, roomId])

  const stopTyping = useCallback(() => {
    clearTimeout(stopTimer.current)
    if (isTypingRef.current && socket) {
      isTypingRef.current = false
      socket.emit('typing:stop', { roomId })
    }
  }, [socket, roomId])

  const typingText = typers.length === 0
    ? null
    : typers.length === 1
      ? `${typers[0].username} is typing…`
      : typers.length === 2
        ? `${typers[0].username} and ${typers[1].username} are typing…`
        : `${typers.length} people are typing…`

  return { typingText, onKeystroke, stopTyping }
}
