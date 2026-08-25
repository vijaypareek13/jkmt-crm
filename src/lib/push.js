import { supabase } from './supabase'

// The public half of the VAPID pair — public by design, the browser shows it
// to the push service. The private half lives in app_secrets, server-side only.
const VAPID_PUBLIC = 'BFZF0nYDFUgYgMSpP_UDMxj4MKjG7G8tkVm6N9k_9wy3xY3TMXu-fhGU3PUHG6wOgImBFy9-0uZy5hb_6hODBcE'

function urlB64(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

// Every await races a timeout that names its own step — this once hung
// silently on the phone, and a button that does nothing cannot be debugged.
const step = (p, ms, what) => Promise.race([p,
  new Promise((_, rej) => setTimeout(() => rej(new Error(`Stuck at: ${what}`)), ms))])

// Ask, subscribe, save. Returns 'ok' | 'denied' | 'unsupported'.
// On iPhone this only works after Add to Home Screen — Safari's tab has no pushManager.
export async function enablePush(userId) {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return 'unsupported'
  let reg
  try { reg = await step(navigator.serviceWorker.register('/sw.js'), 8000, 'registering the service worker') }
  catch (e) { throw new Error('Service worker refused: ' + e.message) }
  try { await step(navigator.serviceWorker.ready, 8000, 'waiting for the service worker to activate') }
  catch { /* keep going — subscribe below tells its own truth */ }
  if (!reg.pushManager) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  const sub = await step(
    reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(VAPID_PUBLIC) }),
    15000, 'subscribing with the push service')
  const j = sub.toJSON()
  const { error } = await step(supabase.from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: userId }),
    10000, 'saving the subscription')
  if (error) throw new Error('Subscription not saved: ' + error.message)
  return 'ok'
}
