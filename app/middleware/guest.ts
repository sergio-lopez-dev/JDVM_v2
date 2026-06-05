// Solo para no autenticados (login, registro, recuperación).
export default defineNuxtRouteMiddleware(async () => {
  const user = await getCurrentUser()
  if (user) return navigateTo('/app')
})
