// client/src/context/SocketContext.jsx
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { io } from 'socket.io-client'
import { useAuth } from './AuthContext'

const SocketContext = createContext(null)
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:4000'

export function SocketProvider({ children }) {
  const { user } = useAuth()
  const socketRef = useRef(null)
  const [connected, setConnected] = useState(false)
  const [onlineUsers, setOnlineUsers] = useState(new Set())

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect()
      socketRef.current = null
      return
    }

    const token = localStorage.getItem('token')
    const socket = io(SOCKET_URL, {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    })

    socket.on('connect',    () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    // Presence: maintain a Set of online user IDs
    socket.on('presence:update', ({ userId, isOnline }) => {
      setOnlineUsers(prev => {
        const next = new Set(prev)
        isOnline ? next.add(userId) : next.delete(userId)
        return next
      })
    })

    // Heartbeat every 10s — keeps presence last_seen fresh
    // If we stop sending (tab hidden, connection lost), last_seen goes stale
    // and the TTL check in SQL marks the user as offline automatically.
    const heartbeat = setInterval(() => socket.emit('heartbeat'), 10_000)

    socketRef.current = socket
    return () => {
      clearInterval(heartbeat)
      socket.disconnect()
    }
  }, [user])

  return (
    <SocketContext.Provider value={{ socket: socketRef.current, connected, onlineUsers }}>
      {children}
    </SocketContext.Provider>
  )
}

export function useSocket() {
  return useContext(SocketContext)
}
