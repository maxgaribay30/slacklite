// client/src/pages/ChatPage.jsx
import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSocket } from '../context/SocketContext'
import { api } from '../lib/api'
import Sidebar from '../components/Sidebar'
import ChannelView from '../components/ChannelView'
import DMView from '../components/DMView'

export default function ChatPage() {
  const { user, logout } = useAuth()
  const { connected } = useSocket()
  const [rooms, setRooms]   = useState([])
  const [users, setUsers]   = useState([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get('/api/rooms').then(setRooms).catch(console.error)
    api.get('/api/users').then(setUsers).catch(console.error)
  }, [])

  function addRoom(room) {
    setRooms(prev => [...prev, { ...room, is_member: true }])
    navigate(`/room/${room.id}`)
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      <Sidebar
        rooms={rooms}
        users={users}
        currentUser={user}
        connected={connected}
        onLogout={logout}
        onRoomCreated={addRoom}
      />
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Routes>
          <Route path="/" element={
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#666', fontSize: 15 }}>
              Select a channel or DM to start chatting
            </div>
          } />
          <Route path="/room/:roomId" element={<ChannelView rooms={rooms} />} />
          <Route path="/dm/:userId"   element={<DMView users={users} />} />
        </Routes>
      </div>
    </div>
  )
}
