import { useEffect, useState } from 'react'
import { supabase, FUNCTIONS_URL } from '../lib/supabase'

// The shop's AI switch and its brain. The OpenAI key is written through the
// ai-key function into app_secrets and never read back — this screen only
// ever learns whether one is set. The per-chat switch lives in the lead panel.
export default function AiSettings({ onClose }) {
  const [cfg, setCfg] = useState(null)
  const [keySet, setKeySet] = useState(null)
  const [keyInput, setKeyInput] = useState('')
  const [busy, setBusy] = useState(false)

  async function authHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    return {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session?.access_token}`,
    }
  }

  useEffect(() => {
    supabase.from('ai_settings').select('*').eq('id', 1).single().then(({ data }) => data && setCfg(data))
    authHeaders().then(h => fetch(`${FUNCTIONS_URL}/ai-key`, { headers: h }))
      .then(r => r.json()).then(j => setKeySet(!!j.set)).catch(() => setKeySet(false))
  }, [])

  async function save() {
    setBusy(true)
    const { error } = await supabase.from('ai_settings').update({
      enabled: cfg.enabled, system_prompt: cfg.system_prompt, model: cfg.model,
      reply_delay_sec: Number(cfg.reply_delay_sec) || 5, updated_at: new Date().toISOString(),
    }).eq('id', 1)
    setBusy(false)
    if (error) { alert('Not saved: ' + error.message); return }
    onClose()
  }

  async function saveKey() {
    setBusy(true)
    try {
      const r = await fetch(`${FUNCTIONS_URL}/ai-key`, {
        method: 'POST', headers: await authHeaders(), body: JSON.stringify({ key: keyInput.trim() }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Key not saved')
      setKeySet(true); setKeyInput('')
      alert('Key saved. It is stored on the server and never shown again.')
    } catch (e) { alert(e.message) }
    setBusy(false)
  }

  if (!cfg) return null
  return (
    <div className="drawer" onClick={onClose}>
      <div className="panel" onClick={e => e.stopPropagation()}>
        <h3>AI auto-reply</h3>
        <div className="sub">Answers new WhatsApp messages when you are away. Turn it off for one customer from their Lead panel.</div>

        <label className="toggle" style={{ borderTop: 0, marginTop: 0 }}>
          <span><b>AI replies for the whole shop</b></span>
          <input type="checkbox" checked={cfg.enabled} onChange={e => setCfg({ ...cfg, enabled: e.target.checked })} />
        </label>

        <label className="field"><span>What the AI is told (its instructions)</span>
          <textarea rows={6} value={cfg.system_prompt ?? ''} onChange={e => setCfg({ ...cfg, system_prompt: e.target.value })} /></label>
        <div className="row2">
          <label className="field"><span>Model</span>
            <input value={cfg.model ?? ''} onChange={e => setCfg({ ...cfg, model: e.target.value })} /></label>
          <label className="field"><span>Wait before replying (sec)</span>
            <input type="number" min="0" value={cfg.reply_delay_sec ?? 5} onChange={e => setCfg({ ...cfg, reply_delay_sec: e.target.value })} /></label>
        </div>

        <div className="field">
          <span>OpenAI key {keySet === null ? '' : keySet ? '— set ✓' : '— not set, AI cannot reply yet'}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="password" placeholder={keySet ? 'Paste a new key to replace it' : 'sk-…'} value={keyInput}
              onChange={e => setKeyInput(e.target.value)} style={{ flex: 1 }} autoComplete="off" />
            <button className="btn ghost sm" disabled={busy || !keyInput.trim()} onClick={saveKey}>Save key</button>
          </div>
        </div>

        <div className="actions">
          <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : 'Save'}</button>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  )
}
