<script setup lang="ts">
useHead({ title: 'JDVM Hair Studio' })
const dev = import.meta.dev
</script>

<template>
  <main
    class="relative mx-auto flex min-h-dvh max-w-md flex-col justify-center overflow-hidden px-6"
  >
    <UiGrain :opacity="0.4" />
    <div class="relative z-10 flex flex-col gap-6">
      <AppLogo :size="34" />
      <p class="text-primary font-mono text-[0.7rem] tracking-[0.3em] uppercase">
        Barbería · desde 2018
      </p>
      <h1 class="font-display text-default text-6xl leading-[0.95]">
        Tu sitio en la silla, a un toque.
      </h1>
      <p class="text-muted">Reserva con tu barbero de siempre, sin llamadas ni esperas.</p>
      <div class="flex gap-3">
        <UButton to="/login" color="primary" size="lg" icon="i-lucide-scissors">Reservar</UButton>
        <UButton to="/registro" color="neutral" variant="subtle" size="lg">Crear cuenta</UButton>
      </div>
      <NuxtLink
        v-if="dev"
        to="/_styleguide"
        class="text-dimmed hover:text-muted text-xs underline underline-offset-4"
      >
        → Styleguide (solo dev)
      </NuxtLink>
    </div>
  </main>
</template>
