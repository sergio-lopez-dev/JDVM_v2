// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@pinia/nuxt',
    '@vee-validate/nuxt',
    // Animación: registramos solo motion-v (cubre animaciones complejas y
    // springs/transiciones simples). @vueuse/motion sigue instalado por si en
    // la Fase 1 queremos su directiva v-motion; entonces se añade como plugin.
    // Registrar ambos módulos colisiona en auto-imports (useSpring, etc.).
    'motion-v/nuxt',
    'nuxt-vuefire',
    '@vite-pwa/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  // Pre-empaquetar deps que se importan en runtime (esquemas Zod) para evitar
  // el aviso de Vite y la recarga de página la primera vez.
  vite: {
    optimizeDeps: {
      include: ['zod'],
    },
  },

  // App dark-only (tema forest). Forzamos modo oscuro y evitamos el flash claro.
  colorMode: {
    preference: 'dark',
    fallback: 'dark',
  },

  // TypeScript estricto en todo el proyecto.
  typescript: {
    strict: true,
    // El typecheck completo lo corremos aparte (pnpm typecheck / pre-commit)
    // para no ralentizar el dev server.
    typeCheck: false,
  },

  // Fuentes de marca (mismo set que el diseño Claude Design).
  // En una fase posterior podemos migrar a @nuxt/fonts si interesa self-host.
  app: {
    head: {
      htmlAttrs: { lang: 'es' },
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/icons/favicon-32x32.png' },
        { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        {
          rel: 'stylesheet',
          // Serifs de todas las direcciones de marca (la paleta activa elige una
          // vía --font-display). Ver lib/themes.ts.
          href: 'https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Newsreader:ital,wght@0,400;0,500;0,600;1,400&family=Bodoni+Moda:ital,wght@0,400;0,500;0,600;0,700&family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600&family=Spectral:wght@400;500;600&family=Libre+Caslon+Display&family=Hanken+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
        },
      ],
    },
  },

  // Reglas de render por ruta.
  // - Público (landing, estudio, carta): estático/ISR para SEO y velocidad.
  // - Área autenticada y admin: SPA (ssr:false), datos en cliente vía VueFire.
  // Se irá afinando conforme aterricen las páginas reales en fases 3 y 4.
  routeRules: {
    // Landing pública con SSR en vivo (NO prerender): debe reflejar la marca y los
    // datos configurados en admin (nombre, contacto, carta, equipo…). Prerenderizar
    // la congelaría con los valores por defecto del build.
    '/': { ssr: true },
    // Área autenticada del cliente = SPA (datos en cliente vía VueFire; el
    // middleware de auth corre en cliente, sin flash de redirección en SSR).
    '/app/**': { ssr: false },
    '/admin/**': { ssr: false },
    '/staff/**': { ssr: false },
    '/perfil': { ssr: false },
    '/reservar': { ssr: false },
    '/estudio': { ssr: false },
    '/estudio/**': { ssr: false },
    '/barbero/**': { ssr: false },
    '/carta': { ssr: false },
    '/citas/**': { ssr: false },
    '/valorar/**': { ssr: false },
    '/lista-espera': { ssr: false },
    '/avisos': { ssr: false },
  },

  // Configuración Firebase (config web pública — segura de exponer en cliente).
  // Los valores reales viven en .env (ver .env.example).
  vuefire: {
    // Config web de Firebase (PÚBLICA: va embebida en el bundle del cliente). Los
    // valores por defecto son los del proyecto jdvm-v2 para que el deploy funcione
    // sin variables de entorno; se pueden sobreescribir con NUXT_PUBLIC_FIREBASE_*.
    config: {
      apiKey: process.env.NUXT_PUBLIC_FIREBASE_API_KEY || 'AIzaSyAl7pFF3il_cxGLNztRu5Sq5RbDX5SEcUI',
      authDomain: process.env.NUXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'jdvm-v2.firebaseapp.com',
      // Con emuladores usamos un projectId demo: imposible tocar prod por error.
      projectId:
        process.env.NUXT_PUBLIC_USE_EMULATORS === 'true'
          ? 'demo-jdvm'
          : process.env.NUXT_PUBLIC_FIREBASE_PROJECT_ID || 'jdvm-v2',
      storageBucket: process.env.NUXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'jdvm-v2.firebasestorage.app',
      messagingSenderId: process.env.NUXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '135452502895',
      appId: process.env.NUXT_PUBLIC_FIREBASE_APP_ID || '1:135452502895:web:62d716839fc02fbd84569a',
      measurementId: process.env.NUXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-7NMEQRYMQC',
    },
    auth: { enabled: true },
    // Emuladores en desarrollo (NUXT_PUBLIC_USE_EMULATORS=true). Puertos en
    // firebase.json. Todo el trabajo con datos va contra emuladores, no prod.
    emulators: {
      enabled: process.env.NUXT_PUBLIC_USE_EMULATORS === 'true',
    },
  },

  // PWA mínima funcional. Iconos y estrategia offline se completan en Fase 5.
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'JDVM Hair Studio',
      short_name: 'JDVM',
      description: 'Reserva tu cita en JDVM Hair Studio.',
      lang: 'es',
      theme_color: '#0b0f0c',
      background_color: '#0b0f0c',
      display: 'standalone',
      icons: [
        { src: '/icons/icon-192x192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icons/icon-512x512.png', sizes: '512x512', type: 'image/png' },
        {
          src: '/icons/icon-512x512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ],
    },
    devOptions: { enabled: false },
  },
})
