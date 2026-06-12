import { doc, serverTimestamp, setDoc } from 'firebase/firestore'

// "Último acceso" como presencia real: actualiza users/{uid}.lastLogin no solo al
// hacer login, sino al abrir/usar la app, con un heartbeat throttleado. Así el admin
// ve en /admin/clientes quién está entrando/activo (para avisar de huecos o animar a
// reservar). Se escribe como mucho cada STALE_MS para no saturar Firestore.
const STALE_MS = 5 * 60 * 1000

export function usePresence() {
  if (!import.meta.client) return
  const db = useFirestore()
  const user = useCurrentUser()
  let lastWrite = 0

  async function touch() {
    const u = user.value
    if (!u || document.visibilityState === 'hidden') return
    const now = Date.now()
    if (now - lastWrite < STALE_MS) return
    lastWrite = now
    try {
      await setDoc(doc(db, COL.users, u.uid), { lastLogin: serverTimestamp() }, { merge: true })
    } catch {
      /* sin permisos / offline: no es crítico */
    }
  }

  let timer: ReturnType<typeof setInterval> | undefined
  watch(user, (u) => u && touch(), { immediate: true })
  onMounted(() => {
    timer = setInterval(touch, STALE_MS)
    document.addEventListener('visibilitychange', touch)
  })
  onUnmounted(() => {
    if (timer) clearInterval(timer)
    document.removeEventListener('visibilitychange', touch)
  })
}
