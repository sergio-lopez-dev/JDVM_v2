import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { deleteApp, getApp, getApps, initializeApp } from 'firebase/app'
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  updateProfile,
} from 'firebase/auth'
import type { Barber, BarberInput } from '~~/schemas'

// Traduce los códigos de error de Firebase Auth a un mensaje claro en español.
function authErrorMessage(code?: string): string {
  switch (code) {
    case 'auth/email-already-in-use':
      return 'Ya existe una cuenta con ese email.'
    case 'auth/invalid-email':
      return 'El email no es válido.'
    case 'auth/weak-password':
      return 'La contraseña es demasiado débil (mínimo 6 caracteres).'
    case 'auth/operation-not-allowed':
      return 'El acceso por email/contraseña no está habilitado en Firebase.'
    default:
      return 'No se pudo crear la cuenta del barbero.'
  }
}

export function useBarbers() {
  const db = useFirestore()
  const app = useFirebaseApp()
  const primaryAuth = useFirebaseAuth()!
  const col = collection(db, COL.barbers)
  const barbers = useCollection<Barber>(col)

  const active = computed(() => barbers.value.filter((b) => b.active))
  const bySlug = (slug: string) =>
    computed(() => barbers.value.find((b) => b.slug === slug) ?? null)

  const create = (input: BarberInput) => addDoc(col, input)

  // Alta de barbero CON cuenta de acceso. La cuenta de Auth se crea en una app
  // de Firebase SECUNDARIA para no alterar la sesión del admin (createUser inicia
  // sesión con el nuevo usuario en esa app aparte; al borrarla, la sesión del
  // admin en la app principal queda intacta). El uid resultante se usa como id de
  // `barbers/{uid}` y `users/{uid}` (rol 'barber'), tal y como exigen las reglas:
  // appointment.barberId == request.auth.uid.
  async function createWithAccount(
    input: BarberInput,
    creds: { email: string; password: string },
  ) {
    const secName = 'jdvm-barber-creator'
    // Reutiliza una instancia previa si quedó colgada de un intento fallido.
    const secApp = getApps().some((a) => a.name === secName)
      ? getApp(secName)
      : initializeApp(app.options, secName)
    try {
      const secAuth = getAuth(secApp)
      // Espeja el emulador de la app principal (si está activo) para no pegar a prod.
      const em = (
        primaryAuth as unknown as {
          emulatorConfig?: { protocol: string; host: string; port: number }
        }
      ).emulatorConfig
      if (em)
        connectAuthEmulator(secAuth, `${em.protocol}://${em.host}:${em.port}`, {
          disableWarnings: true,
        })

      const cred = await createUserWithEmailAndPassword(secAuth, creds.email, creds.password).catch(
        (e: { code?: string }) => {
          throw new Error(authErrorMessage(e?.code))
        },
      )
      await updateProfile(cred.user, { displayName: input.name })
      const uid = cred.user.uid

      // Docs escritos con la sesión del admin (app principal) → pasan las reglas.
      await setDoc(doc(db, COL.users, uid), {
        name: input.name,
        email: creds.email,
        phone: '',
        role: 'barber',
        allowPush: false,
        createdAt: serverTimestamp(),
      })
      await setDoc(doc(db, COL.barbers, uid), input)
      return uid
    } finally {
      await deleteApp(secApp).catch(() => {})
    }
  }

  const update = (id: string, patch: Partial<BarberInput>) =>
    updateDoc(doc(db, COL.barbers, id), patch)

  // Borra el barbero y, si su id coincide con un uid (barberos creados con cuenta,
  // donde barbers/{uid} == users/{uid}), también su doc de usuario para que no quede
  // con rol 'barber' huérfano. La cuenta de Auth NO se puede borrar desde el cliente
  // (requiere Admin SDK / Cloud Function); queda inactiva sin docs asociados.
  async function remove(id: string) {
    await deleteDoc(doc(db, COL.barbers, id))
    await deleteDoc(doc(db, COL.users, id)).catch(() => {})
  }

  return { barbers, active, bySlug, create, createWithAccount, update, remove }
}
