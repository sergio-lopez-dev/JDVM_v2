// Recupera la app cuando, tras un nuevo deploy, el navegador intenta cargar un chunk
// JS que ya no existe (hashes cambiados) → "Failed to fetch dynamically imported
// module". Vite emite `vite:preloadError` y Nuxt el hook `app:chunkError`; en ambos
// recargamos una vez para coger el bundle nuevo. Guarda anti-bucle: máx. 1 recarga
// cada 10 s (si el fallo fuese real y no por deploy, no entra en bucle infinito).
export default defineNuxtPlugin((nuxtApp) => {
  if (!import.meta.client) return

  const KEY = 'jdvm-chunk-reload-at'
  function reloadOnce() {
    let last = 0
    try {
      last = Number(sessionStorage.getItem(KEY) || 0)
    } catch {
      /* sessionStorage no disponible */
    }
    if (Date.now() - last < 10_000) return
    try {
      sessionStorage.setItem(KEY, String(Date.now()))
    } catch {
      /* ignore */
    }
    window.location.reload()
  }

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault?.()
    reloadOnce()
  })

  nuxtApp.hook('app:chunkError', () => {
    reloadOnce()
  })
})
