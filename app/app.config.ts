// Configuración de Nuxt UI (tokens de marca, tema "forest").
// - primary = 'gold'  → rampa dorada definida en assets/css/main.css
// - neutral = 'ink'   → rampa neutra cálida verdosa (fondos/bordes/textos)
// Los tokens semánticos (--ui-bg, --ui-text, …) se remapean a forest en main.css.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'gold',
      neutral: 'ink',
    },
  },
})
