import { useEffect, useState } from 'react'
import { supabase, STATUS } from '../lib/supabase'

export default function LeadPanel({ thread, session, onClose }) {
  const [c, setC] = useState({ name: thread.name ?? '', business_name: thread.business_name ?? '', city: thread.city ?? '', notes: '', tags: '' })
  const [l, setL] = useState({ status: thread.status ?? 'new', interest: '', expected_value: '', next_follow_up_at: '', ai_enabled: thread.ai_enabled ?? true, needs_human: thread.needs_human ?? false })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('contacts').select('*').eq('id', thread.contact_id).single()
      .then(({ data }) => data && setC({ name: data.name ?? '', business_name: data.business_name ?? '', city: data.city ?? '', notes: data.notes ?? '', tags: (data.tags ?? []).join(', ') }))
    if (thread.lead_id) supabase.from('leads').select('*').eq('id', thread.lead_id).single()
      .then(({ data }) => data && setL({ status: data.status, interest: data.interest ?? '', expected_value: data.expected_value ?? '', ai_enabled: data.ai_enabled, needs_human: data.needs_human,
        next_follow_up_at: data.next_follow_up_at ? new Date(data.next_follow_up_at).toISOString().slice(0, 16) : '' }))
  }, [thread.contact_id, thread.lead_id])

  async function save() {
    setBusy(true)
    await supabase.from('contacts').update({ name: c.name || null, business_name: c.business_name || null, city: c.city || null, notes: c.notes || null,
      tags: c.tags.split(',').map(s => s.trim()).filter(Boolean) }).eq('id', thread.contact_id)
    const leadRow = { status: l.status, interest: l.interest || null, expected_value: l.expected_value || null, ai_enabled: l.ai_enabled, needs_human: l.needs_human,
      next_follow_up_at: l.next_follow_up_at ? new Date(l.next_follow_up_at).toISOString() : null }
    if (thread.lead_id) await supabase.from('leads').update(leadRow).eq('id', thread.lead_id)
    else await supabase.from('leads').insert({ ...leadRow, contact_id: thread.contact_id, source: 'manual' })
    setBusy(false); onClose()
  }

  return (
    <div className="drawer" onClick={onClose}>
      <div className="panel" onClick={e => e.stopPropagation()}>
        <h3>{c.name || `+${thread.wa_id}`}</h3>
        <div className="sub">+{thread.wa_id}</div>

        <div className="row2">
          <label className="field"><span>Name</span><input value={c.name} onChange={e => setC({ ...c, name: e.target.value })} /></label>
          <label className="field"><span>City</span><input value={c.city} onChange={e => setC({ ...c, city: e.target.value })} /></label>
        </div>
        <label className="field"><span>Business / shop</span><input value={c.business_name} onChange={e => setC({ ...c, business_name: e.target.value })} /></label>
        <label className="field"><span>Tags (comma separated)</span><input placeholder="cotton, surat, price sensitive" value={c.tags} onChange={e => setC({ ...c, tags: e.target.value })} /></label>

        <div className="field"><span>Lead status</span>
          <div className="status-grid">
            {Object.entries(STATUS).map(([k, v]) => (
              <button key={k} className={`status-btn ${l.status === k ? 'on' : ''}`} style={l.status === k ? { background: v.color, borderColor: v.color } : {}} onClick={() => setL({ ...l, status: k })}>{v.label}</button>
            ))}
          </div>
        </div>
        <label className="field"><span>Interested in</span><input placeholder="e.g. Cotton 60x60, 5000 mtr" value={l.interest} onChange={e => setL({ ...l, interest: e.target.value })} /></label>
        <div className="row2">
          <label className="field"><span>Expected value (₹)</span><input type="number" value={l.expected_value} onChange={e => setL({ ...l, expected_value: e.target.value })} /></label>
          <label className="field"><span>Next follow-up</span><input type="datetime-local" value={l.next_follow_up_at} onChange={e => setL({ ...l, next_follow_up_at: e.target.value })} /></label>
        </div>
        <label className="field"><span>Notes</span><textarea rows={3} value={c.notes} onChange={e => setC({ ...c, notes: e.target.value })} /></label>

        <label className="toggle"><span>AI auto-reply for this chat</span><input type="checkbox" checked={l.ai_enabled} onChange={e => setL({ ...l, ai_enabled: e.target.checked })} /></label>
        <label className="toggle" style={{ marginTop: 0 }}><span>Needs my attention</span><input type="checkbox" checked={l.needs_human} onChange={e => setL({ ...l, needs_human: e.target.checked })} /></label>

        <div className="actions">
          <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save changes'}</button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
