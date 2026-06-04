// Flat config. Parte de la config generada por @nuxt/eslint (reglas Vue/TS de
// Nuxt) y desactiva al final lo que choque con Prettier (que se encarga del
// formato). Ver: https://eslint.nuxt.com
import withNuxt from './.nuxt/eslint.config.mjs'
import prettier from 'eslint-config-prettier'

export default withNuxt(
  // inputs/ son referencias de diseño (React/JSX), no código del proyecto.
  { ignores: ['inputs/**'] },
  {
    rules: {
      // Permitimos nombres de página de una palabra (index.vue, login.vue…).
      'vue/multi-word-component-names': 'off',
      // Con <script setup lang="ts"> los props opcionales se tipan con `?`;
      // no exigimos un default explícito.
      'vue/require-default-prop': 'off',
    },
  },
  prettier,
)
