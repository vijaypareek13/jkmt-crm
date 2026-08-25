import { useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function go(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pw })
    if (error) setErr(error.message)
    setBusy(false)
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={go}>
        <div className="brand">JKMT Fabrics<small>WhatsApp Sales CRM</small></div>
        <label className="field"><span>Email</span>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="username" required /></label>
        <label className="field"><span>Password</span>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} autoComplete="current-password" required /></label>
        {err && <div className="error">{err}</div>}
        <button className="btn w" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </div>
  )
}
