<script setup lang="ts">
// Aplica la paleta de marca configurada por el admin (settings/main.theme) a
// toda la app, en vivo. Ver app/composables/useBrandTheme.ts.
useBrandThemeSync()

// Actualiza el "último acceso" mientras se usa la app (presencia para que el admin
// vea quién está activo). Ver app/composables/usePresence.ts.
usePresence()

// Título de pestaña white-label: cada página pone su nombre y aquí se le añade el
// nombre del estudio configurado (settings.studio.name).
const { name } = useStudio()
useHead({
  titleTemplate: (title) => (title ? `${title} · ${name.value}` : name.value),
})
</script>

<template>
  <UApp>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
