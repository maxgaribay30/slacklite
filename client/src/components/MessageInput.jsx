// client/src/components/MessageInput.jsx
import { useState, useRef } from 'react'

export default function MessageInput({ onSend, placeholder, typingText }) {
  const [value, setValue] = useState('')
  const [sending, setSending] = useState(false)

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  async function send() {
    const content = value.trim()
    if (!content || sending) return
    setSending(true)
    try {
      await onSend(content)
      setValue('')
    } finally {
      setSending(false)
    }
  }

  return (
    <div style={{ padding: '0 16px 16px' }}>
      {typingText && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', height: 18, marginBottom: 4, paddingLeft: 4 }}>
          <em>{typingText}</em>
        </div>
      )}
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-hover)', borderRadius: 8, padding: '8px 12px', border: '1px solid var(--border)' }}>
        <textarea
          value={value}
          onChange={e => setValue(e.target.value)}
          onKeyDown={handleKey}
          placeholder={placeholder}
          rows={1}
          style={{
            flex: 1, background: 'none', border: 'none', outline: 'none', resize: 'none',
            color: 'var(--text-primary)', fontSize: 15, lineHeight: 1.5,
            maxHeight: 120, overflowY: 'auto',
          }}
        />
        <button
          onClick={send}
          disabled={!value.trim() || sending}
          style={{
            padding: '6px 14px', background: value.trim() ? 'var(--accent)' : 'var(--bg-surface)',
            color: value.trim() ? '#fff' : 'var(--text-muted)', borderRadius: 6, fontSize: 14,
            fontWeight: 500, transition: 'background .15s', flexShrink: 0,
          }}
        >
          Send
        </button>
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, paddingLeft: 4 }}>
        Enter to send · Shift+Enter for new line
      </div>
    </div>
  )
}
