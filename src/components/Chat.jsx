import { useEffect, useRef, useState } from 'react'
import { supabase, sendWhatsApp, STATUS, fmtTime } from '../lib/supabase'
import LeadPanel from './LeadPanel'
import PhotoPicker from './PhotoPicker'

const TICK = { queued: '🕓', sent: '✓', delivered: '✓✓', read: '✓✓', failed: '!' }

export default function Chat({ thread, session, onBack }) {
  const [msgs, setMsgs] = useState([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [panel, setPanel] = useState(false)
  const [picker, setPicker] = useState(false)
  const endRef = useRef(null)

  async function load() {
    const { data } = await supabase.from('messages').select('*').eq('contact_id', thread.contact_id).order('created_at')
    setMsgs(data ?? [])
  }
  useEffect(() => {
    load()
    const ch = supabase.channel(`chat-${thread.contact_id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages', filter: `contact_id=eq.${thread.contact_id}` }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [thread.contact_id])
  useEffect(() => { endRef.current?.scrollIntoView({ block: 'end' }) }, [msgs])

  async function send(payload) {
    setBusy(true); setErr('')
    try {
      await sendWhatsApp({ contact_id: thread.contact_id, lead_id: thread.lead_id, ...payload })
      setText('')
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && text.trim()) { e.preventDefault(); send({ text: text.trim() }) }
  }

  let lastDay = ''
  return (
    <section className="pane chat">
      <header className="chat-head">
        <button className="btn ghost sm back" onClick={onBack}>‹</button>
        <div className="avatar">{(thread.name || thread.wa_id).slice(0, 1).toUpperCase()}</div>
        <button className="who" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => setPanel(true)}>
          <b>{thread.name || `+${thread.wa_id}`}</b>
          <span>+{thread.wa_id}{thread.city ? ` · ${thread.city}` : ''}{thread.business_name ? ` · ${thread.business_name}` : ''}</span>
        </button>
        {thread.status && <span className="pill" style={{ background: STATUS[thread.status].color }}>{STATUS[thread.status].label}</span>}
        <button className="btn ghost sm" onClick={() => setPanel(true)}>Lead</button>
      </header>

      <div className="msgs">
        {msgs.map(m => {
          const day = new Date(m.created_at).toDateString()
          const showDay = day !== lastDay; lastDay = day
          const out = m.direction === 'outbound'
          return (
            <div key={m.id} style={{ display: 'contents' }}>
              {showDay && <div className="day">{new Date(m.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</div>}
              <div className={`bubble ${out ? 'out' : 'in'} ${m.sender === 'ai' ? 'ai' : ''}`}>
                {m.sender === 'ai' && <div className="who">AI reply</div>}
                {m.media_url && (m.type === 'image' ? <img src={m.media_url} alt="" loading="lazy" /> : <a href={m.media_url} target="_blank" rel="noreferrer">📎 {m.type}</a>)}
                {m.body}
                <span className="t">{fmtTime(m.created_at)}{out && <span className={`tick ${m.status}`}>{TICK[m.status] ?? ''}</span>}</span>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {err && <div className="error" style={{ padding: '4px 14px', background: 'var(--white)' }}>{err}</div>}
      <div className="composer">
        <button className="ic" title="Send photos" onClick={() => setPicker(true)}>📷</button>
        <textarea rows={1} placeholder="Type a message" value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey} disabled={busy} />
        <button className="send" disabled={busy || !text.trim()} onClick={() => send({ text: text.trim() })}>{busy ? '…' : 'Send'}</button>
      </div>

      {panel && <LeadPanel thread={thread} session={session} onClose={() => setPanel(false)} />}
      {picker && <PhotoPicker onClose={() => setPicker(false)} onSend={async (photos, caption) => {
        setPicker(false)
        for (const p of photos) await send({ image_url: p.public_url, caption: caption || p.caption || undefined })
      }} />}
    </section>
  )
}
