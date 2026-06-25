import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging'

// Push FCM en el cliente: pedir permiso, obtener/guardar token y avisos en primer
// plano. El token se guarda en users_v2/{uid}/fcmTokens/{token}; las Cloud Functions
// leen ahí para enviar recordatorios y avisos de citas. Requiere la clave VAPID
// (runtimeConfig.public.fcmVapidKey) y el SW /firebase-messaging-sw.js.
//
// IMPORTANTE (anti-duplicados): cada registro/reinstalación del SW genera un token
// FCM nuevo. Si no se limpian, el MISMO dispositivo acumula varios tokens y el push
// llega repetido (p. ej. 4 avisos iguales). Por eso a cada dispositivo le asignamos
// un `deviceId` persistente (localStorage) y, al (re)registrar, borramos los tokens
// antiguos de ese mismo dispositivo/navegador. Así solo queda un token por equipo.
const DEVICE_KEY = 'jdvm-device-id'
function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY)
  if (!id) {
    id =
      globalThis.crypto?.randomUUID?.() ??
      `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
    localStorage.setItem(DEVICE_KEY, id)
  }
  return id
}

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

  // Preferencia GUARDADA del usuario (users_v2/{uid}.allowPush). El permiso del
  // navegador no se puede revocar por código, así que el estado on/off de la app NO
  // puede depender solo de `permission`: lo lleva `allowPush`. `enabled` = el usuario
  // quiere push aquí Y el navegador lo permite.
  const storedAllowPush = ref(false)
  const enabled = computed(() => storedAllowPush.value && permission.value === 'granted')

  async function check() {
    if (!import.meta.client) return
    supported.value = (await isSupported().catch(() => false)) && 'Notification' in window
    if ('Notification' in window)
      permission.value = Notification.permission as typeof permission.value
    const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent)
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true
    iosNeedsInstall.value = isIos && !standalone && !supported.value
  }

  onMounted(check)

  // Borra los tokens de ESTE mismo dispositivo distintos del actual: los del mismo
  // deviceId (esquema nuevo) y los antiguos sin deviceId pero del mismo navegador
  // (mismo userAgent). Evita recibir varias push iguales en un solo equipo.
  async function cleanupStaleTokens(
    uid: string,
    deviceId: string,
    ua: string,
    currentToken: string,
  ) {
    try {
      const snap = await getDocs(collection(db, COL.users, uid, 'fcmTokens'))
      const dels: Promise<void>[] = []
      for (const d of snap.docs) {
        if (d.id === currentToken) continue
        const data = d.data() as { deviceId?: string; ua?: string }
        const sameDevice = data.deviceId === deviceId
        const legacySameBrowser = !data.deviceId && data.ua === ua
        if (sameDevice || legacySameBrowser) dels.push(deleteDoc(d.ref))
      }
      await Promise.all(dels)
    } catch {
      /* sin permisos / offline: no es crítico */
    }
  }

  // Registra explícitamente el SW de FCM y espera a que esté listo. Dejar que
  // `getToken` lo auto-registre fallaba en algunos Android (no encontraba/activaba el
  // SW → el botón "Activar" no hacía nada). Registrarlo a mano y pasárselo a getToken
  // es lo recomendado y robusto entre navegadores.
  async function ensureSwRegistration(): Promise<ServiceWorkerRegistration | undefined> {
    if (!('serviceWorker' in navigator)) return undefined
    try {
      const reg = await navigator.serviceWorker.register('/firebase-messaging-sw.js')
      await navigator.serviceWorker.ready.catch(() => {})
      return reg
    } catch {
      return undefined
    }
  }

  // Obtiene el token de este dispositivo y lo guarda (limpiando los antiguos del
  // mismo equipo). Devuelve true si quedó registrado.
  async function registerToken(): Promise<boolean> {
    if (!user.value || !vapidKey) return false
    const messaging = getMessaging(app)
    const swReg = await ensureSwRegistration()
    const token = await getToken(messaging, { vapidKey, serviceWorkerRegistration: swReg })
    if (!token) return false
    lastToken = token
    const uid = user.value.uid
    const deviceId = getDeviceId()
    const ua = navigator.userAgent
    // Doc keyed por token (lo que leen las Functions) + deviceId para deduplicar.
    await setDoc(
      doc(db, COL.users, uid, 'fcmTokens', token),
      { createdAt: serverTimestamp(), ua, deviceId },
      { merge: true },
    )
    await setDoc(doc(db, COL.users, uid), { allowPush: true }, { merge: true })
    await cleanupStaleTokens(uid, deviceId, ua, token)
    return true
  }

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
        toast.add({
          title: 'Permiso de notificaciones denegado',
          color: 'warning',
          icon: 'i-lucide-bell-off',
        })
        return
      }
      const ok = await registerToken()
      if (!ok) throw new Error('No se pudo obtener el token')
      storedAllowPush.value = true
      toast.add({ title: 'Notificaciones activadas', icon: 'i-lucide-bell-ring', color: 'success' })
    } catch (e) {
      toast.add({
        title: 'No se pudieron activar',
        description: (e as Error).message,
        color: 'error',
      })
    } finally {
      enabling.value = false
    }
  }

  // Desactiva en este dispositivo (borra su token). Refleja el estado al instante
  // (`storedAllowPush = false` → `enabled` pasa a false aunque el permiso del navegador
  // siga concedido).
  async function disable() {
    if (!user.value) return
    storedAllowPush.value = false
    await setDoc(doc(db, COL.users, user.value.uid), { allowPush: false }, { merge: true })
    if (lastToken)
      await deleteDoc(doc(db, COL.users, user.value.uid, 'fcmTokens', lastToken)).catch(() => {})
    toast.add({ title: 'Notificaciones desactivadas', icon: 'i-lucide-bell-off' })
  }

  // Lee la preferencia guardada (allowPush) al cargar / cambiar de usuario, para que el
  // toggle del perfil refleje el estado real (y no quede "Activadas" tras desactivar).
  watch(
    user,
    async (u) => {
      if (!u) {
        storedAllowPush.value = false
        return
      }
      try {
        const snap = await getDoc(doc(db, COL.users, u.uid))
        storedAllowPush.value = snap.data()?.allowPush === true
      } catch {
        /* no crítico */
      }
    },
    { immediate: true },
  )

  // Auto-saneo silencioso: si el usuario YA tiene push activado y el permiso sigue
  // concedido, al abrir la app re-registra el token y limpia los antiguos del mismo
  // dispositivo. Así un barbero con tokens acumulados (push repetidas) queda con uno
  // solo sin hacer nada. NO se re-activa a quien lo tiene desactivado (allowPush).
  let healed = false
  watch(
    [user, permission, storedAllowPush],
    async ([u, p, ap]) => {
      if (healed || !u || p !== 'granted' || !ap) return
      healed = true
      try {
        await registerToken()
      } catch {
        /* no crítico */
      }
    },
    { immediate: true },
  )

  // Avisos en primer plano (app abierta) → toast.
  let unsub: (() => void) | undefined
  onMounted(async () => {
    if (!import.meta.client || !(await isSupported().catch(() => false))) return
    try {
      unsub = onMessage(getMessaging(app), (payload) => {
        // Mensajes data-only (ver functions/pushToTokens): título/cuerpo en data.
        const d = payload.data || {}
        const title = d.title || payload.notification?.title
        const body = d.body || payload.notification?.body
        if (title || body)
          toast.add({ title: title || 'Aviso', description: body, icon: 'i-lucide-bell' })
      })
    } catch {
      /* mensajería no disponible en este contexto */
    }
  })
  onUnmounted(() => unsub?.())

  return { supported, permission, enabled, enabling, iosNeedsInstall, enable, disable }
}
