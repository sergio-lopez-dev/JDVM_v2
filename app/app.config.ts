// Configuración de Nuxt UI (tokens de marca).
// PROVISIONAL: 'gold' es nuestra rampa custom (definida en assets/css/main.css)
// y 'stone' es un neutro cálido de stock como placeholder. En la Fase 1, con
// themes.js delante, se afinan ambos a los valores exactos del tema "forest".
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'gold',
      neutral: 'stone',
    },
  },
})
