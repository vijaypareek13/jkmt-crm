// Shows chat notifications while the site is open somewhere (Android needs a
// service worker for this — new Notification() throws there). Not web push:
// with every tab closed, nothing arrives until the PWA/push work is done.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()))

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
