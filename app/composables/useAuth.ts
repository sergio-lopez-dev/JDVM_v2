import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  indexedDBLocalPersistence,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { normalizeEmail } from '~~/schemas'
import type { SignInInput, SignUpInput } from '~~/schemas'

// Capa de autenticación. Email/Contraseña + Google (decisión de producto).
// Encapsula el SDK de Firebase: los componentes usan SIEMPRE este composable.
export function useAuth() {
  const auth = useFirebaseAuth()!
  const db = useFirestore()
  const user = useCurrentUser()

  // Persistencia de la sesión. `remember` (por defecto true) = se mantiene iniciada
  // entre arranques (clave en PWA / acceso directo): IndexedDB, con fallback a
  // localStorage. Si el usuario NO marca "mantener sesión", se usa persistencia de
  // sesión (se cierra al cerrar el navegador/pestaña). Debe fijarse ANTES del login.
  async function ensurePersistence(remember = true) {
    if (!remember) {
      try {
        await setPersistence(auth, browserSessionPersistence)
      } catch {
        // modo privado / sin storage: la sesión queda solo en memoria
      }
      return
    }
    try {
      await setPersistence(auth, indexedDBLocalPersistence)
    } catch {
      try {
        await setPersistence(auth, browserLocalPersistence)
      } catch {
        // Algunos navegadores en modo privado no permiten persistencia; se sigue igual.
      }
    }
  }

  // Crea el doc users/{uid} en el primer acceso (rol 'client' por defecto).
  async function ensureUserDoc(fbUser: User, extra: { name?: string; phone?: string } = {}) {
    const ref = doc(db, COL.users, fbUser.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      // Compartimos base con la app legacy (v1): un cliente de siempre ya tiene su
      // nombre/teléfono en la colección `users` de la v1. Si aún no se ha migrado su
      // doc a `users_v2`, lo sembramos desde el legacy para NO volver a pedirle datos
      // que ya tiene (lo que hacía que se le mandara a /completar-perfil al entrar).
      let legacy: { name?: string; phone?: unknown; instagram?: string } = {}
      try {
        const legacySnap = await getDoc(doc(db, 'users', fbUser.uid))
        if (legacySnap.exists()) legacy = legacySnap.data() as typeof legacy
      } catch {
        // sin permisos / offline: seguimos con lo que tengamos
      }
      await setDoc(ref, {
        name: extra.name ?? fbUser.displayName ?? legacy.name ?? '',
        email: fbUser.email ?? '',
        phone: extra.phone ?? (legacy.phone ? String(legacy.phone) : ''),
        instagram: legacy.instagram ?? '',
        role: 'client',
        allowPush: false,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      })
    } else {
      await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true })
    }
    // Si hay una invitación de barbero pendiente para este email, la reclama:
    // crea barbers/{uid} y eleva el rol. Así el barbero se da de alta con Google
    // o contraseña usando el email invitado y aterriza en su app (/staff).
    await claimBarberInvite(fbUser)
  }

  // Convierte al usuario en barbero si su email tiene una invitación pendiente.
  // Idempotente: si ya es barbero o no hay invitación, no hace nada.
  async function claimBarberInvite(fbUser: User): Promise<boolean> {
    if (!fbUser.email) return false
    const id = normalizeEmail(fbUser.email)
    const inviteRef = doc(db, COL.barberInvites, id)
    const inviteSnap = await getDoc(inviteRef)
    if (!inviteSnap.exists()) return false
    const invite = inviteSnap.data() as { status?: string; barber?: Record<string, unknown> }
    if (invite.status !== 'pending' || !invite.barber) return false

    const uid = fbUser.uid
    // users/{uid}: eleva a barbero (conserva nombre/teléfono si ya los tenía).
    await setDoc(
      doc(db, COL.users, uid),
      { role: 'barber', name: (invite.barber.name as string) || fbUser.displayName || '' },
      { merge: true },
    )
    // barbers/{uid}: materializa el barbero con los datos de la invitación.
    await setDoc(doc(db, COL.barbers, uid), invite.barber)
    // Marca la invitación como aceptada.
    await setDoc(
      inviteRef,
      { status: 'accepted', acceptedUid: uid, acceptedAt: serverTimestamp() },
      { merge: true },
    )
    return true
  }

  async function signUp(input: SignUpInput) {
    await ensurePersistence()
    const cred = await createUserWithEmailAndPassword(auth, input.email, input.password)
    await updateProfile(cred.user, { displayName: input.name })
    await ensureUserDoc(cred.user, { name: input.name, phone: input.phone })
    return cred.user
  }

  // Registro con email/contraseña SIN exigir teléfono (para el alta de barbero por
  // invitación). ensureUserDoc reclama la invitación y eleva el rol si procede.
  async function registerWithPassword(input: { email: string; password: string; name?: string }) {
    await ensurePersistence()
    const cred = await createUserWithEmailAndPassword(auth, input.email, input.password)
    if (input.name) await updateProfile(cred.user, { displayName: input.name })
    await ensureUserDoc(cred.user, { name: input.name })
    return cred.user
  }

  async function signIn(input: SignInInput, opts: { remember?: boolean } = {}) {
    await ensurePersistence(opts.remember ?? true)
    const cred = await signInWithEmailAndPassword(auth, input.email, input.password)
    await ensureUserDoc(cred.user)
    return cred.user
  }

  async function signInWithGoogle(opts: { remember?: boolean } = {}) {
    await ensurePersistence(opts.remember ?? true)
    const cred = await signInWithPopup(auth, new GoogleAuthProvider())
    await ensureUserDoc(cred.user)
    return cred.user
  }

  async function signOut() {
    await fbSignOut(auth)
    await navigateTo('/login')
  }

  function sendReset(email: string) {
    return sendPasswordResetEmail(auth, email)
  }

  // Lee el rol del usuario (para enrutar tras el login).
  async function roleOf(uid: string) {
    const snap = await getDoc(doc(db, COL.users, uid))
    return (snap.data()?.role as string | undefined) ?? 'client'
  }

  // Destino por defecto según rol: barbero → app de barbero; resto → cliente.
  async function destinationFor(uid: string) {
    return (await roleOf(uid)) === 'barber' ? '/staff' : '/app'
  }

  return {
    user,
    signUp,
    registerWithPassword,
    signIn,
    signInWithGoogle,
    signOut,
    sendReset,
    ensureUserDoc,
    roleOf,
    destinationFor,
  }
}
