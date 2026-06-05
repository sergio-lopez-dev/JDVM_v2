import { doc, getDoc } from 'firebase/firestore'

// Requiere rol barber o admin.
export default defineNuxtRouteMiddleware(async (to) => {
  const user = await getCurrentUser()
  if (!user) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })

  const db = useFirestore()
  const snap = await getDoc(doc(db, 'users', user.uid))
  const role = snap.data()?.role
  if (role !== 'barber' && role !== 'admin') return navigateTo('/app')
})
