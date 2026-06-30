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
import { barberAccessExpired } from '~~/lib/barber'

// Contraseña temporal fuerte: el barbero NUNCA la usa. Solo existe para poder crear
// la cuenta; el barbero fija la suya con el enlace del email de invitación.
function tempPassword(): string {
  const bytes = new Uint8Array(24)
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + 'Aa1!'
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
  const barbersRaw = useCollection<Barber>(col)

  // Orden estable: sortOrder asc (lo fija el admin), desempate por nombre. Se aplica
  // a todas las listas (admin y selector de reserva) para un orden coherente.
  const byOrder = (a: Barber, b: Barber) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'es')
  const barbers = computed(() => [...barbersRaw.value].sort(byOrder))

  // Activos y "vigentes": un barbero temporal fuera de su rango de fechas se trata como
  // inactivo (no aparece en reserva, estudio, agenda ni selectores).
  const active = computed(() => barbers.value.filter((b) => b.active && !barberAccessExpired(b)))
  const bySlug = (slug: string) =>
    computed(() => barbers.value.find((b) => b.slug === slug) ?? null)

  const create = (input: BarberInput) => addDoc(col, input)

  // Alta de barbero sobre una cuenta YA existente (id = uid de Auth). Lo usa el
  // admin para añadirse a sí mismo como barbero sin crear otra cuenta: conserva su
  // rol y, como barbers/{uid} == su uid, las reglas de citas cuadran. No toca
  // users/{uid} (sigue siendo admin → es admin Y barbero a la vez).
  const addForUid = (uid: string, input: BarberInput) => setDoc(doc(db, COL.barbers, uid), input)

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
  // su contraseña. OJO: ese dominio debe estar en "Dominios autorizados" de Firebase
  // Auth; si no, el envío falla con auth/unauthorized-continue-uri.
  function inviteSettings() {
    return import.meta.client
      ? { url: `${window.location.origin}/login`, handleCodeInApp: false }
      : undefined
  }

  // Envía el email de invitación (flujo "restablecer contraseña" reutilizado como
  // alta). Robusto: si el continue URL no está autorizado (dominio no whitelisteado),
  // reintenta SIN él para que el correo se mande igual. Acepta el Auth a usar
  // (principal o el de la app secundaria recién creada).
  async function sendInviteWith(auth: ReturnType<typeof getAuth>, email: string) {
    auth.languageCode = 'es' // el correo de Firebase sale en español
    const settings = inviteSettings()
    try {
      await sendPasswordResetEmail(auth, email, settings)
    } catch (e) {
      const code = (e as { code?: string })?.code ?? ''
      if (settings && /continue-uri|unauthorized-continue/.test(code)) {
        await sendPasswordResetEmail(auth, email) // sin redirección final
      } else {
        throw e
      }
    }
  }

  // Reenviar la invitación a un barbero ya existente.
  const sendInvite = (email: string) => sendInviteWith(primaryAuth, email)

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
        await sendInviteWith(secAuth, email)
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

  return {
    barbers,
    active,
    bySlug,
    create,
    addForUid,
    createWithAccount,
    sendInvite,
    update,
    remove,
  }
}
