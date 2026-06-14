import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore'
import type { Client } from '~~/schemas'

// Doc Firestore del usuario logueado (incluye su rol) + helpers de rol.
export function useCurrentClient() {
  const db = useFirestore()
  const user = useCurrentUser()

  const docRef = computed(() => (user.value ? doc(db, COL.users, user.value.uid) : null))
  const client = useDocument<Client>(docRef)

  const role = computed(() => client.value?.role ?? null)
  const isAdmin = computed(() => role.value === 'admin')
  const isStaff = computed(() => role.value === 'admin' || role.value === 'barber')

  // ¿Hemos terminado de comprobar el doc legacy v1 para sembrar el teléfono? Hasta
  // que no lo sepamos NO pedimos completar perfil (si no, parpadearía "completa tu
  // perfil" al arrancar antes de tener los datos).
  const legacyChecked = ref(false)
  let attempted = false

  // Auto-reparación del teléfono. Antes solo se sembraba desde el legacy en
  // `ensureUserDoc` (al INICIAR sesión). Con "mantener sesión iniciada" ese login no
  // se repite, así que un cliente de siempre cuyo doc v2 quedó sin teléfono se
  // quedaba atascado: cada vez que abría la PWA se le mandaba a /completar-perfil.
  // Ahora, en CADA carga, si el doc v2 no tiene teléfono lo sembramos desde el doc
  // legacy `users/{uid}` (base compartida con la v1) sin necesidad de re-loguear.
  watch(
    () => [user.value?.uid, !!client.value, client.value?.phone] as const,
    async () => {
      const uid = user.value?.uid
      if (!uid || !client.value) return
      if (client.value.phone) {
        legacyChecked.value = true
        return
      }
      if (attempted) return
      attempted = true
      try {
        const legacy = await getDoc(doc(db, 'users', uid))
        const data = legacy.exists() ? (legacy.data() as { phone?: unknown; name?: string }) : {}
        const patch: Record<string, unknown> = {}
        if (data.phone) patch.phone = String(data.phone)
        if (!client.value.name && data.name) patch.name = data.name
        if (Object.keys(patch).length) {
          await setDoc(doc(db, COL.users, uid), { ...patch, lastLogin: serverTimestamp() }, { merge: true })
        }
      } catch {
        // sin permisos / offline: seguimos; se pedirá completar perfil
      } finally {
        legacyChecked.value = true
      }
    },
    { immediate: true },
  )

  // Falta completar perfil (típico tras login con Google sin teléfono). Solo se
  // considera incompleto DESPUÉS de comprobar el legacy, para no pedir datos que el
  // cliente ya tiene en la app v1.
  const needsProfile = computed(() => legacyChecked.value && !!client.value && !client.value.phone)

  return { client, role, isAdmin, isStaff, needsProfile }
}
