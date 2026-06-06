import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
  updateProfile,
  type User,
} from 'firebase/auth'
import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import type { SignInInput, SignUpInput } from '~~/schemas'

// Capa de autenticación. Email/Contraseña + Google (decisión de producto).
// Encapsula el SDK de Firebase: los componentes usan SIEMPRE este composable.
export function useAuth() {
  const auth = useFirebaseAuth()!
  const db = useFirestore()
  const user = useCurrentUser()

  // Crea el doc users/{uid} en el primer acceso (rol 'client' por defecto).
  async function ensureUserDoc(fbUser: User, extra: { name?: string; phone?: string } = {}) {
    const ref = doc(db, 'users', fbUser.uid)
    const snap = await getDoc(ref)
    if (!snap.exists()) {
      await setDoc(ref, {
        name: extra.name ?? fbUser.displayName ?? '',
        email: fbUser.email ?? '',
        phone: extra.phone ?? '',
        role: 'client',
        allowPush: false,
        createdAt: serverTimestamp(),
        lastLogin: serverTimestamp(),
      })
    } else {
      await setDoc(ref, { lastLogin: serverTimestamp() }, { merge: true })
    }
  }

  async function signUp(input: SignUpInput) {
    const cred = await createUserWithEmailAndPassword(auth, input.email, input.password)
    await updateProfile(cred.user, { displayName: input.name })
    await ensureUserDoc(cred.user, { name: input.name, phone: input.phone })
    return cred.user
  }

  async function signIn(input: SignInInput) {
    const cred = await signInWithEmailAndPassword(auth, input.email, input.password)
    await ensureUserDoc(cred.user)
    return cred.user
  }

  async function signInWithGoogle() {
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
    const snap = await getDoc(doc(db, 'users', uid))
    return (snap.data()?.role as string | undefined) ?? 'client'
  }

  // Destino por defecto según rol: barbero → app de barbero; resto → cliente.
  async function destinationFor(uid: string) {
    return (await roleOf(uid)) === 'barber' ? '/staff' : '/app'
  }

  return { user, signUp, signIn, signInWithGoogle, signOut, sendReset, ensureUserDoc, roleOf, destinationFor }
}
