import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase, STATUS, fmtTime } from '../lib/supabase'
import { enablePush } from '../lib/push'
import Chat from './Chat'
import QuickReplies from './QuickReplies'
import AiSettings from './AiSettings'

// A short tone instead of an audio file — nothing to load, nothing to cache.
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const o = ctx.createOscillator(), g = ctx.createGain()
    o.connect(g); g.connect(ctx.destination)
    o.frequency.value = 880; g.gain.value = 0.08
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25)
    o.stop(ctx.currentTime + 0.3)
  } catch { /* autoplay policy may refuse before the first tap — fine */ }
}

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'needs_human', label: 'Needs me' },
  { key: 'new', label: 'New' },
  { key: 'follow_up', label: 'Follow up' },
  { key: 'pending', label: 'Pending' },
  { key: 'closed_won', label: 'Closed' },
]

export default function Inbox({ session }) {
  const [threads, setThreads] = useState([])
  const [active, setActive] = useState(null)
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const [quick, setQuick] = useState(false)
  const [ai, setAi] = useState(false)

  // The subscription is made once, so it reads live state through refs.
  const threadsRef = useRef([]); useEffect(() => { threadsRef.current = threads }, [threads])
  const activeRef = useRef(null); useEffect(() => { activeRef.current = active }, [active])

  async function load() {
    const { data } = await supabase.from('inbox').select('*').order('last_message_at', { ascending: false, nullsFirst: false })
    setThreads(data ?? [])
  }

  // New incoming message, and the person is not reading that chat right now:
  // a sound always, a system notification when the tab is not in front.
  function notifyInbound(m) {
    if (m.direction !== 'inbound') return
    if (activeRef.current === m.contact_id && document.hasFocus()) return
    beep()
    if (document.hasFocus()) return
    if (!('Notification' in window) || Notification.permission !== 'granted') return
    const t = threadsRef.current.find(x => x.contact_id === m.contact_id)
    const title = t?.name || (t ? `+${t.wa_id}` : 'New message')
    const body = m.type === 'image' ? '📷 Photo' : (m.body || m.type)
    // tag = one notification per chat that overwrites itself, like WhatsApp
    const opts = { body, tag: m.contact_id, data: { contact_id: m.contact_id } }
    navigator.serviceWorker?.getRegistration().then(r => {
      if (r) r.showNotification(title, opts)
      else { const n = new Notification(title, opts); n.onclick = () => { window.focus(); setActive(m.contact_id); n.close() } }
    })
  }

  useEffect(() => {
    load()
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission()
    // Already allowed once → refresh the push subscription quietly on every open,
    // because push services expire endpoints without saying so.
    if (window.Notification?.permission === 'granted') enablePush(session.user.id).catch(() => {})
    const ch = supabase.channel('inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, p => notifyInbound(p.new))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, load)
      .subscribe()
    // A notification tapped on the lock screen — the service worker says which chat
    const onMsg = e => { if (e.data?.open) setActive(e.data.open) }
    navigator.serviceWorker?.addEventListener('message', onMsg)
    return () => { supabase.removeChannel(ch); navigator.serviceWorker?.removeEventListener('message', onMsg) }
  }, [])

  // Unread total in the tab title, so a minimized window still says something
  useEffect(() => {
    const n = threads.reduce((s, t) => s + (t.unread_count || 0), 0)
    document.title = n ? `(${n}) JKMT CRM` : 'JKMT CRM'
  }, [threads])

  const list = useMemo(() => threads.filter(t => {
    if (q) {
      const s = q.toLowerCase()
      if (!(t.name?.toLowerCase().includes(s) || t.wa_id.includes(s) || t.business_name?.toLowerCase().includes(s) || t.city?.toLowerCase().includes(s))) return false
    }
    if (filter === 'all') return true
    if (filter === 'unread') return t.unread_count > 0
    if (filter === 'needs_human') return t.needs_human
    return t.status === filter
  }), [threads, q, filter])

  const activeThread = threads.find(t => t.contact_id === active) ?? null

  return (
    <div className={`shell ${active ? 'chat-open' : ''}`}>
      <section className="pane list">
        <header className="topbar">
          <div className="brand">JKMT<small>Sales CRM</small></div>
          <div className="spacer" />
          <button className="ic" title="AI auto-reply" onClick={() => setAi(true)}>🤖</button>
          <button className="ic" title="Quick replies" onClick={() => setQuick(true)}>⚡</button>
          <button className="ic" title="Enable notifications" onClick={async () => {
            try {
              const r = await enablePush(session.user.id)
              alert(r === 'ok' ? 'Notifications are on. New messages will reach this device even when the app is closed.'
                : r === 'denied' ? 'Notifications are blocked for this site — allow them in the browser settings and try again.'
                : 'Not supported here. On iPhone: Share → Add to Home Screen, then open the app from its icon and press the bell again.')
            } catch (e) { alert(e.message) }
          }}>🔔</button>
          <button className="ic" title="Sign out" onClick={() => supabase.auth.signOut()}>⏻</button>
        </header>
        <div className="search"><input placeholder="Search name, number, city…" value={q} onChange={e => setQ(e.target.value)} /></div>
        <div className="filters">
          {FILTERS.map(f => <button key={f.key} className={`chip ${filter === f.key ? 'on' : ''}`} onClick={() => setFilter(f.key)}>{f.label}</button>)}
        </div>
        <div className="threads">
          {list.length === 0 && <div className="empty-list">{threads.length === 0 ? 'No chats yet. New WhatsApp messages will appear here.' : 'Nothing matches this filter.'}</div>}
          {list.map(t => (
            <button key={t.contact_id} className={`thread ${t.contact_id === active ? 'on' : ''}`} onClick={() => setActive(t.contact_id)}>
              <div className="avatar">{(t.name || t.wa_id).slice(0, 1).toUpperCase()}</div>
              <div style={{ minWidth: 0 }}>
                <div className="name">{t.name || `+${t.wa_id}`}{t.needs_human && <span className="flag" title="AI asked for you">●</span>}</div>
                <div className="last">{t.last_direction === 'outbound' ? '↗ ' : ''}{t.last_message || '—'}</div>
              </div>
              <div className="meta">
                <span>{fmtTime(t.last_message_at)}</span>
                {t.unread_count > 0 ? <span className="badge">{t.unread_count}</span> :
                  t.status && <span className="pill" style={{ background: STATUS[t.status].color }}>{STATUS[t.status].label}</span>}
              </div>
            </button>
          ))}
        </div>
      </section>

      {activeThread
        ? <Chat key={activeThread.contact_id} thread={activeThread} session={session} onBack={() => setActive(null)} />
        : <section className="pane chat empty"><div><div className="brand" style={{ fontSize: 26 }}>JKMT Fabrics</div><p>Select a chat to start replying.</p></div></section>}

      {quick && <QuickReplies manage onClose={() => setQuick(false)} />}
      {ai && <AiSettings onClose={() => setAi(false)} />}
    </div>
  )
}
