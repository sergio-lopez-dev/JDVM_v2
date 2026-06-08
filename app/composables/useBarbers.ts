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
  sendPasswordResetEmail,
  updateProfile,
} from 'firebase/auth'
import type { Barber, BarberInput } from '~~/schemas'

// Contraseña temporal fuerte: el barbero NUNCA la usa. Solo existe para poder crear
// la cuenta; el barbero fija la suya con el enlace del email de invitación.
function tempPassword(): string {
  const bytes = new Uint8Array(24)
  globalThis.crypto.getRandomValues(bytes)
  return (
    Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + 'Aa1!'
  )
}

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

  // Conecta una instancia de Auth al emulador si la app principal lo está (dev),
  // para no pegar a prod al crear cuentas / enviar emails.
  function mirrorEmulator(secAuth: ReturnType<typeof getAuth>) {
    const em = (
      primaryAuth as unknown as {
        emulatorConfig?: { protocol: string; host: string; port: number }
      }
    ).emulatorConfig
    if (em)
      connectAuthEmulator(secAuth, `${em.protocol}://${em.host}:${em.port}`, {
        disableWarnings: true,
      })
  }

  // Continue URL del enlace de invitación: el barbero acaba en /login tras fijar
  // su contraseña. Debe ser un dominio autorizado en Firebase Auth (lo es: el propio).
  function inviteSettings() {
    return import.meta.client
      ? { url: `${window.location.origin}/login`, handleCodeInApp: false }
      : undefined
  }

  // Envía (o reenvía) el email de invitación: enlace de Firebase para que el barbero
  // ponga su contraseña. Es el flujo de "restablecer contraseña" reutilizado como alta.
  async function sendInvite(email: string) {
    await sendPasswordResetEmail(primaryAuth, email, inviteSettings())
  }

  // Alta de barbero CON cuenta de acceso por INVITACIÓN. La cuenta de Auth se crea
  // en una app de Firebase SECUNDARIA para no alterar la sesión del admin (createUser
  // inicia sesión con el nuevo usuario en esa app aparte; al borrarla, la sesión del
  // admin en la app principal queda intacta). El uid resultante se usa como id de
  // `barbers/{uid}` y `users/{uid}` (rol 'barber'), como exigen las reglas
  // (appointment.barberId == request.auth.uid). El barbero recibe un email para fijar
  // su contraseña (no la elige el admin). Devuelve si el email salió: si falla, el
  // barbero ya existe y el admin puede reenviar la invitación.
  async function createWithAccount(input: BarberInput, email: string) {
    const secName = 'jdvm-barber-creator'
    // Reutiliza una instancia previa si quedó colgada de un intento fallido.
    const secApp = getApps().some((a) => a.name === secName)
      ? getApp(secName)
      : initializeApp(app.options, secName)
    try {
      const secAuth = getAuth(secApp)
      mirrorEmulator(secAuth)

      const cred = await createUserWithEmailAndPassword(secAuth, email, tempPassword()).catch(
        (e: { code?: string }) => {
          throw new Error(authErrorMessage(e?.code))
        },
      )
      await updateProfile(cred.user, { displayName: input.name })
      const uid = cred.user.uid

      // Docs escritos con la sesión del admin (app principal) → pasan las reglas.
      await setDoc(doc(db, COL.users, uid), {
        name: input.name,
        email,
        phone: '',
        role: 'barber',
        allowPush: false,
        createdAt: serverTimestamp(),
      })
      await setDoc(doc(db, COL.barbers, uid), input)

      // Email de invitación. Si falla (red, etc.) no abortamos: el barbero ya existe.
      let invited = true
      try {
        await sendPasswordResetEmail(secAuth, email, inviteSettings())
      } catch {
        invited = false
      }
      return { uid, invited }
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

  return { barbers, active, bySlug, create, createWithAccount, sendInvite, update, remove }
}
