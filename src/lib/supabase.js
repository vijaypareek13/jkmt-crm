import { createClient } from '@supabase/supabase-js'
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)
export const FUNCTIONS_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`

export async function sendWhatsApp(payload) {
  const { data: { session } } = await supabase.auth.getSession()
  const r = await fetch(`${FUNCTIONS_URL}/wa-send`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${session?.access_token ?? import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(payload),
  })
  const j = await r.json()
  if (!r.ok) throw new Error(j.error || 'Send failed')
  return j
}

export const STATUS = {
  new: { label: 'New', color: '#2F6FED' },
  follow_up: { label: 'Follow up', color: '#D9822B' },
  pending: { label: 'Pending', color: '#8A6D3B' },
  closed_won: { label: 'Closed ✓', color: '#1E9E6A' },
  closed_lost: { label: 'Lost', color: '#8C8C8C' },
}

export function fmtTime(ts) {
  if (!ts) return ''
  const d = new Date(ts), now = new Date()
  const same = d.toDateString() === now.toDateString()
  if (same) return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const y = new Date(now); y.setDate(now.getDate() - 1)
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
}
