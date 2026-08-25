import { useEffect, useMemo, useState } from 'react'
import { supabase, STATUS, fmtTime } from '../lib/supabase'
import Chat from './Chat'

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

  async function load() {
    const { data } = await supabase.from('inbox').select('*').order('last_message_at', { ascending: false, nullsFirst: false })
    setThreads(data ?? [])
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('inbox')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

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
    </div>
  )
}
