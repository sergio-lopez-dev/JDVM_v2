/* Service worker de Firebase Cloud Messaging (push en segundo plano).
 * Config web PÚBLICA del proyecto prod (jdvm-d82b6). El SW no lee variables de
 * entorno, así que va embebida (es segura de exponer). */
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyD7jvu1cpduFNh3kiM7_CS3nsX0lDxtKMQ',
  authDomain: 'jdvm-d82b6.firebaseapp.com',
  projectId: 'jdvm-d82b6',
  storageBucket: 'jdvm-d82b6.appspot.com',
  messagingSenderId: '816309940847',
  appId: '1:816309940847:web:c4672271d5d78d7542139a',
})

const messaging = firebase.messaging()

// Push en segundo plano → muestra notificación del sistema.
messaging.onBackgroundMessage((payload) => {
  const n = payload.notification || {}
  const data = payload.data || {}
  self.registration.showNotification(n.title || 'JDVM Hair Studio', {
    body: n.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    data: { link: data.link || '/', ...data },
  })
})

// Al tocar la notificación, abre/enfoca la app en el enlace indicado.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const link = (event.notification.data && event.notification.data.link) || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const w of wins) {
        if ('focus' in w) {
          if ('navigate' in w) w.navigate(link).catch(() => {})
          return w.focus()
        }
      }
      return self.clients.openWindow(link)
    }),
  )
})
