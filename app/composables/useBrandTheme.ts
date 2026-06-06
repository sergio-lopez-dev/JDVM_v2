import { getTheme, themeCssVars, DEFAULT_THEME_KEY } from '~~/lib/themes'

// Paleta de marca configurable por el admin (settings/main.theme), aplicada a
// TODA la app en runtime. Por defecto = forest (la cableada en main.css).
export const THEME_COOKIE = 'jdvm-theme'

// Sobreescribe las CSS custom properties del <html> con las del tema elegido.
// Como el bloque `.dark` de main.css deriva los tokens de Nuxt UI de los
// `--jdvm-*`, cambiar los crudos re-tematiza la UI entera en cascada.
export function applyBrandTheme(key: string | undefined | null) {
  if (!import.meta.client) return
  const t = getTheme(key)
  const el = document.documentElement
  const vars = themeCssVars(t)
  for (const [prop, value] of Object.entries(vars)) el.style.setProperty(prop, value)
  // Los controles nativos (scrollbars, inputs de fecha) siguen el esquema.
  el.style.colorScheme = t.light ? 'light' : 'dark'
  el.dataset.brand = t.key
}

// Mantiene la paleta de la app sincronizada con settings/main, en vivo y para
// todos los usuarios. Se invoca una sola vez en app.vue.
export function useBrandThemeSync() {
  if (!import.meta.client) return

  const cookie = useCookie<string>(THEME_COOKIE, {
    default: () => DEFAULT_THEME_KEY,
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  })

  // Aplica de inmediato la última paleta conocida (cookie) para evitar el flash
  // antes de que Firestore entregue settings.
  applyBrandTheme(cookie.value)

  const { settings } = useSettings()
  watch(
    () => settings.value?.theme,
    (key) => {
      if (!key) return
      cookie.value = key
      applyBrandTheme(key)
    },
    { immediate: true },
  )
}
