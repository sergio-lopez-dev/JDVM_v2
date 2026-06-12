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
// Los mensajes llegan DATA-ONLY (las Functions no envían `notification` para evitar
// el doble aviso de FCM web): título y cuerpo vienen en `data`.
messaging.onBackgroundMessage((payload) => {
  const data = payload.data || {}
  const n = payload.notification || {}
  self.registration.showNotification(data.title || n.title || 'JDVM Hair Studio', {
    body: data.body || n.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-192x192.png',
    tag: data.appointmentId || undefined, // colapsa duplicados del mismo evento
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
