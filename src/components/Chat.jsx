import { useEffect, useRef, useState } from 'react'
import { supabase, sendWhatsApp, STATUS, fmtTime, fetchQuickReplies } from '../lib/supabase'
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
  const [qr, setQr] = useState(null)      // quick replies, fetched the first time "/" is typed
  const [pending, setPending] = useState([])   // photos staged by a quick reply, sent on Send
  const [view, setView] = useState(null)  // full-screen image preview
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
      const res = await sendWhatsApp({ contact_id: thread.contact_id, lead_id: thread.lead_id, ...payload })
      setText('')
      // The message went to WhatsApp but the CRM's own record was refused —
      // it will not appear in this list. Say so; do not resend, the customer got it.
      if (res.db_error) setErr('Sent to WhatsApp, but not saved in the CRM: ' + res.db_error)
    } catch (e) { setErr(e.message) }
    setBusy(false)
  }
  // What is in the composer — typed text and staged photos — goes together.
  // A photo carries no caption of its own: the library caption is a filename,
  // not something a customer should read.
  async function sendAll() {
    const phs = [...pending]
    if (text.trim()) await send({ text: text.trim() })
    for (const p of phs) await send({ image_url: p.public_url })
    setPending([])
  }
  function onKey(e) {
    if (e.key === 'Enter' && !e.shiftKey && (text.trim() || pending.length)) { e.preventDefault(); sendAll() }
  }

  // A quick reply fills the composer, exactly as WhatsApp does —
  // the person reads what is about to go, then presses Send.
  function pickQuickReply(r, phs) {
    setText(r.body || '')
    setPending(phs)
  }

  // "/" in the composer — like WhatsApp Business shortcuts
  const slash = text.startsWith('/')
  useEffect(() => { if (slash && !qr) fetchQuickReplies().then(setQr) }, [slash])
  const term = slash ? text.slice(1).toLowerCase() : ''
  const suggestions = slash && qr
    ? qr.replies.filter(r => !term || r.title.toLowerCase().includes(term) || r.body.toLowerCase().includes(term)).slice(0, 6)
    : []

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
        {/* Plain phone call — WhatsApp's own calls cannot be started from a website */}
        <a className="btn ghost sm" href={`tel:+${thread.wa_id}`} title="Call">📞</a>
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
                {m.media_url && (m.type === 'image' ? <img src={m.media_url} alt="" loading="lazy" onClick={() => setView(m.media_url)} /> : <a href={m.media_url} target="_blank" rel="noreferrer">📎 {m.type}</a>)}
                {m.body}
                <span className="t">{fmtTime(m.created_at)}{out && <span className={`tick ${m.status}`}>{TICK[m.status] ?? ''}</span>}</span>
              </div>
            </div>
          )
        })}
        <div ref={endRef} />
      </div>

      {err && <div className="error" style={{ padding: '4px 14px', background: 'var(--white)' }}>{err}</div>}
      {slash && (
        <div className="qrsuggest">
          {!qr ? <div className="qrhint">Loading quick replies…</div>
            : suggestions.length === 0 ? <div className="qrhint">{qr.replies.length ? 'No quick reply matches.' : 'No quick replies saved yet — press ⚡ to make one.'}</div>
            : suggestions.map(r => {
              const phs = (r.photo_ids ?? []).map(id => qr.photos.find(p => p.id === id)).filter(Boolean)
              return (
                <button key={r.id} className="qrpick" disabled={busy} onClick={() => pickQuickReply(r, phs)}>
                  {phs[0] && <img src={phs[0].public_url} alt="" loading="lazy" />}
                  <span>{r.body || `📷 ${phs.length} photo${phs.length > 1 ? 's' : ''}`}</span>
                  <b>/{r.title}</b>
                </button>
              )
            })}
        </div>
      )}
      {pending.length > 0 && (
        <div className="pending">
          {pending.map(p => (
            <span key={p.id} className="pend">
              <img src={p.public_url} alt="" />
              <button title="Remove" onClick={() => setPending(s => s.filter(x => x.id !== p.id))}>✕</button>
            </span>
          ))}
        </div>
      )}
      <div className="composer">
        <button className="ic" title="Send photos" onClick={() => setPicker(true)}>📷</button>
        <textarea rows={1} placeholder="Type a message" value={text} onChange={e => setText(e.target.value)} onKeyDown={onKey} disabled={busy} />
        <button className="send" disabled={busy || (!text.trim() && !pending.length)} onClick={sendAll}>{busy ? '…' : 'Send'}</button>
      </div>

      {view && <div className="lightbox" onClick={() => setView(null)}><img src={view} alt="" /></div>}
      {panel && <LeadPanel thread={thread} session={session} onClose={() => setPanel(false)} />}
      {picker && <PhotoPicker onClose={() => setPicker(false)} onSend={async (photos, caption) => {
        setPicker(false)
        // only a caption the person typed goes out — the library caption is a filename
        for (const p of photos) await send({ image_url: p.public_url, caption: caption || undefined })
      }} />}
    </section>
  )
}
