<script setup lang="ts">
definePageMeta({ middleware: 'auth' })
useHead({ title: 'Inicio · JDVM' })

const user = useCurrentUser()
const { client, needsProfile } = useCurrentClient()
const { signOut } = useAuth()

// Si entró con Google y le falta el teléfono, completar perfil primero.
watch(needsProfile, (v) => {
  if (v) navigateTo('/completar-perfil')
})

const name = computed(() => client.value?.name || user.value?.displayName || 'cliente')
</script>

<template>
  <main class="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-6 py-10">
    <p class="text-primary font-mono text-[0.7rem] tracking-[0.3em] uppercase">Tu cuenta</p>
    <h1 class="font-display text-5xl leading-none">Hola, {{ name }}.</h1>
    <p class="text-muted">
      Tu Home con próximas citas llega en la siguiente pantalla. La autenticación y la capa de
      datos (Fase 2) ya funcionan.
    </p>
    <div class="flex flex-wrap gap-3">
      <UButton color="primary" size="lg" icon="i-lucide-scissors" disabled>Reservar (pronto)</UButton>
      <UButton color="neutral" variant="outline" size="lg" icon="i-lucide-log-out" @click="signOut">
        Cerrar sesión
      </UButton>
    </div>
  </main>
</template>
