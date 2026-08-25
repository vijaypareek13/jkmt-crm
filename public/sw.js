// Two jobs: show chat notifications while the site is open (Android needs a
// service worker even for that), and receive Web Push when it is not — the
// push comes from wa-webhook the moment a customer's message lands.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

self.addEventListener('push', (e) => {
  let d = {}
  try { d = e.data?.json() ?? {} } catch { d = { body: e.data?.text() } }
  e.waitUntil(self.registration.showNotification(d.title || 'JKMT CRM', {
    body: d.body || '',
    tag: d.contact_id || 'jkmt',          // one banner per chat, like WhatsApp
    data: { contact_id: d.contact_id },
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
  }))
})

self.addEventListener('notificationclick', (e) => {
  e.notification.close()
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const c = list[0]
      // Tell the page which chat to open; the page holds all the state.
      if (c) { c.focus(); c.postMessage({ open: e.notification.data?.contact_id }) }
      else self.clients.openWindow('/')
    })
  )
})
