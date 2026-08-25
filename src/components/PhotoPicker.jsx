import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function PhotoPicker({ onClose, onSend }) {
  const [photos, setPhotos] = useState([])
  const [sel, setSel] = useState([])
  const [caption, setCaption] = useState('')
  const [q, setQ] = useState('')
  const [up, setUp] = useState(false)

  async function load() {
    const { data } = await supabase.from('photos').select('*').order('sort_order').order('created_at', { ascending: false })
    setPhotos(data ?? [])
  }
  useEffect(() => { load() }, [])

  async function upload(e) {
    const files = [...e.target.files]; if (!files.length) return
    setUp(true)
    for (const f of files) {
      const path = `library/${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      const { error } = await supabase.storage.from('product-photos').upload(path, f, { contentType: f.type })
      if (error) continue
      const url = supabase.storage.from('product-photos').getPublicUrl(path).data.publicUrl
      await supabase.from('photos').insert({ storage_path: path, public_url: url, caption: f.name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ') })
    }
    setUp(false); load()
  }

  const list = photos.filter(p => !q || (p.caption ?? '').toLowerCase().includes(q.toLowerCase()) || (p.tags ?? []).join(' ').toLowerCase().includes(q.toLowerCase()))
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  return (
    <div className="picker" onClick={onClose}>
      <div className="sheet" onClick={e => e.stopPropagation()}>
        <h3>Photo library <span className="spacer" />
          <label className="upload">{up ? 'Uploading…' : '+ Upload'}<input type="file" accept="image/*" multiple onChange={upload} disabled={up} /></label>
        </h3>
        <input placeholder="Search photos…" value={q} onChange={e => setQ(e.target.value)} style={{ padding: '9px 11px', border: '1px solid var(--line)', borderRadius: 10, marginBottom: 10 }} />
        <div className="grid">
          {list.length === 0 && <div className="empty-list" style={{ gridColumn: '1/-1' }}>{photos.length ? 'No match.' : 'No photos yet — upload your fabric photos once, send them with one tap forever.'}</div>}
          {list.map(p => (
            <button key={p.id} className={`ph ${sel.includes(p.id) ? 'on' : ''}`} onClick={() => toggle(p.id)}>
              <img src={p.public_url} alt={p.caption ?? ''} loading="lazy" />
              {p.caption && <span className="cap">{p.caption}</span>}
            </button>
          ))}
        </div>
        <div className="foot">
          <input placeholder="Caption (optional)" value={caption} onChange={e => setCaption(e.target.value)} />
          <button className="btn" disabled={!sel.length} onClick={() => onSend(photos.filter(p => sel.includes(p.id)), caption)}>Send {sel.length || ''}</button>
        </div>
      </div>
    </div>
  )
}
