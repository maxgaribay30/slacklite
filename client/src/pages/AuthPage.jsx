// client/src/pages/AuthPage.jsx
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const s = {
  page: { display:'flex', alignItems:'center', justifyContent:'center', height:'100%', background:'#1a1d21' },
  card: { width:'100%', maxWidth:400, padding:'2.5rem', background:'#222529', borderRadius:8, border:'1px solid #3d3f44' },
  logo: { fontSize:22, fontWeight:600, color:'#fff', marginBottom:'0.25rem' },
  sub:  { fontSize:14, color:'#999', marginBottom:'2rem' },
  label:{ display:'block', fontSize:13, fontWeight:500, color:'#d1d2d3', marginBottom:6 },
  input:{ width:'100%', padding:'10px 12px', background:'#1a1d21', border:'1px solid #3d3f44',
          borderRadius:6, color:'#fff', outline:'none', marginBottom:16, fontSize:15 },
  btn:  { width:'100%', padding:'10px', background:'#1164a3', color:'#fff', borderRadius:6,
          fontWeight:500, fontSize:15, cursor:'pointer', marginTop:4 },
  err:  { color:'#e8412a', fontSize:13, marginBottom:12 },
  link: { textAlign:'center', marginTop:20, fontSize:13, color:'#999' },
  linkBtn: { color:'#1d9bd1', cursor:'pointer', background:'none', border:'none', fontSize:13 },
}

export default function AuthPage({ register = false }) {
  const [isRegister, setIsRegister] = useState(register)
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)
  const { login, register: doRegister } = useAuth()
  const navigate = useNavigate()

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (isRegister) {
        await doRegister(form.username, form.email, form.password)
      } else {
        await login(form.email, form.password)
      }
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>💬 SlackLite</div>
        <div style={s.sub}>{isRegister ? 'Create an account' : 'Sign in to your workspace'}</div>

        {error && <div style={s.err}>{error}</div>}

        <form onSubmit={submit}>
          {isRegister && (
            <>
              <label style={s.label}>Username</label>
              <input style={s.input} placeholder="yourname" value={form.username} onChange={set('username')} required />
            </>
          )}
          <label style={s.label}>Email</label>
          <input style={s.input} type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required />
          <label style={s.label}>Password</label>
          <input style={s.input} type="password" placeholder={isRegister ? 'At least 8 characters' : '••••••••'} value={form.password} onChange={set('password')} required />
          <button style={s.btn} type="submit" disabled={loading}>
            {loading ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
          </button>
        </form>

        <div style={s.link}>
          {isRegister ? 'Already have an account? ' : "Don't have an account? "}
          <button style={s.linkBtn} onClick={() => { setIsRegister(!isRegister); setError('') }}>
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </div>

        {!isRegister && (
          <div style={{ ...s.link, marginTop: 8 }}>
            Demo: <code style={{ color: '#1d9bd1', fontSize: 12 }}>alex@example.com</code> / <code style={{ color: '#1d9bd1', fontSize: 12 }}>password123</code>
          </div>
        )}
      </div>
    </div>
  )
}
