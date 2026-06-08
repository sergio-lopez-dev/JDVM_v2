import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'

// Push FCM en el cliente: pedir permiso, obtener/guardar token y avisos en primer
// plano. El token se guarda en users_v2/{uid}/fcmTokens/{token}; las Cloud Functions
// leen ahí para enviar recordatorios y avisos de citas. Requiere la clave VAPID
// (runtimeConfig.public.fcmVapidKey) y el SW /firebase-messaging-sw.js.
export function useMessaging() {
  const app = useFirebaseApp()
  const db = useFirestore()
  const user = useCurrentUser()
  const toast = useToast()
  const vapidKey = useRuntimeConfig().public.fcmVapidKey as string

  const supported = ref(false)
  const permission = ref<'default' | 'granted' | 'denied'>('default')
  const enabling = ref(false)
  // iOS solo permite push si la PWA está instalada (añadida a inicio).
  const iosNeedsInstall = ref(false)
  let lastToken = ''

  async function check() {
    if (!import.meta.client) return
    supported.value = (await isSupported().catch(() => false)) && 'Notification' in window
    if ('Notification' in window) permission.value = Notification.permission as typeof permission.value
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    iosNeedsInstall.value = isIos && !standalone && !supported.value
  }

  onMounted(check)

  // Activa las notificaciones (debe llamarse desde un gesto del usuario).
  async function enable() {
    if (!user.value) {
      toast.add({ title: 'Inicia sesión primero', color: 'warning' })
      return
    }
    if (!vapidKey) {
      toast.add({ title: 'Falta configurar la clave VAPID', color: 'error' })
      return
    }
    enabling.value = true
    try {
      const perm = await Notification.requestPermission()
      permission.value = perm as typeof permission.value
      if (perm !== 'granted') {
        toast.add({ title: 'Permiso de notificaciones denegado', color: 'warning', icon: 'i-lucide-bell-off' })
        return
      }
      const messaging = getMessaging(app)
      // getToken registra automáticamente /firebase-messaging-sw.js en su scope.
      const token = await getToken(messaging, { vapidKey })
      if (!token) throw new Error('No se pudo obtener el token')
      lastToken = token
      await setDoc(
        doc(db, COL.users, user.value.uid, 'fcmTokens', token),
        { createdAt: serverTimestamp(), ua: navigator.userAgent },
        { merge: true },
      )
      await setDoc(doc(db, COL.users, user.value.uid), { allowPush: true }, { merge: true })
      toast.add({ title: 'Notificaciones activadas', icon: 'i-lucide-bell-ring', color: 'success' })
    } catch (e) {
      toast.add({ title: 'No se pudieron activar', description: (e as Error).message, color: 'error' })
    } finally {
      enabling.value = false
    }
  }

  // Desactiva en este dispositivo (borra el token).
  async function disable() {
    if (!user.value) return
    await setDoc(doc(db, COL.users, user.value.uid), { allowPush: false }, { merge: true })
    if (lastToken) await deleteDoc(doc(db, COL.users, user.value.uid, 'fcmTokens', lastToken)).catch(() => {})
    toast.add({ title: 'Notificaciones desactivadas', icon: 'i-lucide-bell-off' })
  }

  // Avisos en primer plano (app abierta) → toast.
  let unsub: (() => void) | undefined
  onMounted(async () => {
    if (!import.meta.client || !(await isSupported().catch(() => false))) return
    try {
      unsub = onMessage(getMessaging(app), (payload) => {
        const n = payload.notification
        if (n) toast.add({ title: n.title || 'Aviso', description: n.body, icon: 'i-lucide-bell' })
      })
    } catch {
      /* mensajería no disponible en este contexto */
    }
  })
  onUnmounted(() => unsub?.())

  return { supported, permission, enabling, iosNeedsInstall, enable, disable }
}
