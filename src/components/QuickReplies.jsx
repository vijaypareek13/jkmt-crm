import { useEffect, useState } from 'react'
import { supabase, uploadPhotos, fetchQuickReplies } from '../lib/supabase'

// Saved replies — text and photos together, one tap sends the lot.
// Stored server-side (quick_replies + the photo library), so every device
// carries the same list; a photo is uploaded once and reused forever.
// With `manage` (opened from the inbox, no chat to send into) rows are
// inert — only + New and delete work there.
export default function QuickReplies({ onClose, onSend, manage }) {
  const [list, setList] = useState([])
  const [photos, setPhotos] = useState([])
  const [q, setQ] = useState('')
  const [mode, setMode] = useState('list')   // 'list' | 'new'
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sel, setSel] = useState([])
  const [busy, setBusy] = useState(false)
  const [up, setUp] = useState(false)

  async function load() {
    const { replies, photos } = await fetchQuickReplies()
    setList(replies); setPhotos(photos)
  }
  useEffect(() => { load() }, [])

  async function upload(e) {
    const files = [...e.target.files]; if (!files.length) return
    setUp(true); await uploadPhotos(files); setUp(false); load()
  }

  async function save() {
    setBusy(true)
    const { error } = await supabase.from('quick_replies')
      .insert({ title: title.trim(), body: body.trim(), photo_ids: sel })
    setBusy(false)
    if (error) { alert('Not saved: ' + error.message); return }
    setMode('list'); setTitle(''); setBody(''); setSel([]); load()
  }

  async function del(r) {
    if (!confirm(`Delete "${r.title}"?`)) return
    await supabase.from('quick_replies').delete().eq('id', r.id)
    load()
  }

  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])
  const shown = list.filter(r => !q || r.title.toLowerCase().includes(q.toLowerCase()) || r.body.toLowerCase().includes(q.toLowerCase()))

  return (
    <div className="picker" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        {mode === 'list' ? (<>
          <h3>Quick replies <span className="spacer" />
            <button className="btn ghost sm" onClick={() => setMode('new')}>+ New</button>
          </h3>
          {list.length > 4 && <input placeholder="Search quick replies…" value={q} onChange={e => setQ(e.target.value)}
            style={{ padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 10 }} />}
          <div className="qrlist">
            {shown.length === 0 && <div className="empty-list">{list.length ? 'No match.'
              : 'No quick replies yet. Press + New — save a message with its photos once, send it with one tap forever.'}</div>}
            {shown.map(r => {
              const phs = (r.photo_ids ?? []).map(id => photos.find(p => p.id === id)).filter(Boolean)
              return (
                <div key={r.id} className="qrrow">
                  {/* the whole row sends — that is the point of a quick reply */}
                  <button className="qrbody" disabled={manage} onClick={() => !manage && onSend(r, phs)}>
                    <b>{r.title}</b>
                    {r.body && <span className="qrtext">{r.body}</span>}
                    {phs.length > 0 && <span className="qrthumbs">
                      {phs.slice(0, 4).map(p => <img key={p.id} src={p.public_url} alt="" loading="lazy" />)}
                      {phs.length > 4 && <span className="qrmore">+{phs.length - 4}</span>}
                    </span>}
                  </button>
                  <button className="qrdel" title="Delete" onClick={() => del(r)}>✕</button>
                </div>
              )
            })}
          </div>
        </>) : (<>
          <h3>New quick reply <span className="spacer" />
            <label className="upload">{up ? 'Uploading…' : '+ Upload photos'}<input type="file" accept="image/*" multiple onChange={upload} disabled={up} /></label>
          </h3>
          <label className="field" style={{ marginTop: 0 }}><span>Name (only you see this)</span>
            <input placeholder="e.g. Cotton rates" value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label className="field"><span>Message text</span>
            <textarea rows={3} placeholder="The message that will be sent" value={body} onChange={e => setBody(e.target.value)} /></label>
          <div className="field"><span>Photos to send with it{sel.length ? ` — ${sel.length} chosen` : ''}</span></div>
          <div className="grid" style={{ maxHeight: '30vh' }}>
            {photos.length === 0 && <div className="empty-list" style={{ gridColumn: '1/-1' }}>No photos in the library yet — upload above.</div>}
            {photos.map(p => (
              <button key={p.id} className={`ph ${sel.includes(p.id) ? 'on' : ''}`} onClick={() => toggle(p.id)}>
                <img src={p.public_url} alt={p.caption ?? ''} loading="lazy" />
                {p.caption && <span className="cap">{p.caption}</span>}
              </button>
            ))}
          </div>
          <div className="foot">
            <button className="btn" disabled={busy || !title.trim() || (!body.trim() && !sel.length)} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
            <button className="btn ghost" onClick={() => { setMode('list'); setTitle(''); setBody(''); setSel([]) }}>Cancel</button>
          </div>
        </>)}
      </div>
    </div>
  )
}
