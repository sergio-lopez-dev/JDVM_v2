import { doc, getDoc } from 'firebase/firestore'

// Requiere rol admin (lee users/{uid}.role).
export default defineNuxtRouteMiddleware(async (to) => {
  const user = await getCurrentUser()
  if (!user) return navigateTo({ path: '/login', query: { redirect: to.fullPath } })

  const db = useFirestore()
  const snap = await getDoc(doc(db, 'users', user.uid))
  if (snap.data()?.role !== 'admin') return navigateTo('/app')
})
