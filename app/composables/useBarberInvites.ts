import { collection, deleteDoc, doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { getFunctions, httpsCallable } from 'firebase/functions'
import { normalizeEmail } from '~~/schemas'
import type { BarberInput, BarberInvite } from '~~/schemas'

// Invitaciones de barbero (alta por "reclamo": el barbero se da de alta él mismo con
// Google o contraseña usando el email invitado). Ver useAuth.claimBarberInvite.
export function useBarberInvites() {
  const db = useFirestore()
  const app = useFirebaseApp()
  const col = collection(db, COL.barberInvites)

  // Envía el email de invitación (Cloud Function inviteBarber, región europe-west1).
  // El doc de invitación debe existir ya. Lanza si la función no está desplegada.
  async function sendEmail(email: string) {
    const fns = getFunctions(app, 'europe-west1')
    await httpsCallable(fns, 'inviteBarber')({ email: normalizeEmail(email), origin: window.location.origin })
  }
  // Listado reactivo (para mostrar invitaciones pendientes en admin).
  const invites = useCollection<BarberInvite>(col)
  const pending = computed(() => invites.value.filter((i) => i.status === 'pending'))

  // Crear/actualizar la invitación (id = email normalizado).
  function create(email: string, barber: BarberInput) {
    const id = normalizeEmail(email)
    return setDoc(doc(col, id), {
      email: id,
      barber,
      status: 'pending',
      createdAt: serverTimestamp(),
    })
  }

  async function getByEmail(email: string): Promise<BarberInvite | null> {
    const snap = await getDoc(doc(col, normalizeEmail(email)))
    return snap.exists() ? ({ id: snap.id, ...snap.data() } as BarberInvite) : null
  }

  const remove = (email: string) => deleteDoc(doc(col, normalizeEmail(email)))

  return { invites, pending, create, sendEmail, getByEmail, remove }
}
