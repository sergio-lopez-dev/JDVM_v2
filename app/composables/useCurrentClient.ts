import { doc } from 'firebase/firestore'
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
  // Falta completar perfil (típico tras login con Google sin teléfono).
  const needsProfile = computed(() => !!client.value && !client.value.phone)

  return { client, role, isAdmin, isStaff, needsProfile }
}
