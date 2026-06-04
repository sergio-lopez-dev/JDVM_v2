<script setup lang="ts">
useHead({ title: 'JDVM Hair Studio' })
</script>

<template>
  <main class="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-6">
    <p class="font-mono text-xs uppercase tracking-[0.3em] text-gold-500">JDVM · v2</p>
    <h1 class="font-display text-6xl leading-none">Bienvenida</h1>
    <p class="text-stone-400">
      Arranque del proyecto (Fase 0). El sistema de diseño completo llega en la Fase 1.
    </p>
    <div class="flex gap-3">
      <UButton color="primary" size="lg">Reservar</UButton>
      <UButton color="neutral" variant="subtle" size="lg">El estudio</UButton>
    </div>
  </main>
</template>
