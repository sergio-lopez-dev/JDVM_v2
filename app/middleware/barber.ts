import { doc, getDoc } from 'firebase/firestore'
import { signOut } from 'firebase/auth'
import { barberAccessExpired } from '~~/lib/barber'

// Requiere rol barber o admin. Además, un barbero TEMPORAL caducado (fuera de su rango
// de fechas) pierde el acceso: se cierra su sesión y se le redirige a /login.
export default defineNuxtRouteMiddleware(async (to) => {
  const user = await getCurrentUser()
  if (!user) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })

  const db = useFirestore()
  const snap = await getDoc(doc(db, COL.users, user.uid))
  const role = snap.data()?.role
  if (role !== 'barber' && role !== 'admin') return navigateTo('/app')

  // Barbero temporal: si su acceso ha caducado (o aún no empieza), bloquear.
  if (role === 'barber') {
    const bSnap = await getDoc(doc(db, COL.barbers, user.uid))
    const barber = bSnap.data()
    if (barber && barberAccessExpired(barber as Parameters<typeof barberAccessExpired>[0])) {
      const auth = useFirebaseAuth()
      if (auth) await signOut(auth).catch(() => {})
      return navigateTo({ path: '/login', query: { expired: 'barber' } })
    }
  }
})
