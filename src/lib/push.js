import { supabase } from './supabase'

// The public half of the VAPID pair — public by design, the browser shows it
// to the push service. The private half lives in app_secrets, server-side only.
const VAPID_PUBLIC = 'BFZF0nYDFUgYgMSpP_UDMxj4MKjG7G8tkVm6N9k_9wy3xY3TMXu-fhGU3PUHG6wOgImBFy9-0uZy5hb_6hODBcE'

function urlB64(s) {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const raw = atob((s + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

// Ask, subscribe, save. Returns 'ok' | 'denied' | 'unsupported'.
// On iPhone this only works after Add to Home Screen — Safari's tab has no pushManager.
export async function enablePush(userId) {
  if (!('serviceWorker' in navigator) || !('Notification' in window)) return 'unsupported'
  const reg = await navigator.serviceWorker.ready
  if (!reg.pushManager) return 'unsupported'
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'denied'
  const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(VAPID_PUBLIC) })
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions')
    .upsert({ endpoint: sub.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, user_id: userId })
  if (error) throw new Error('Subscription not saved: ' + error.message)
  return 'ok'
}
