<script setup lang="ts">
const route = useRoute()
const items = [
  { label: 'Inicio', icon: 'i-lucide-house', to: '/app' },
  { label: 'Reservar', icon: 'i-lucide-scissors', to: '/reservar' },
  { label: 'Estudio', icon: 'i-lucide-layout-grid', to: '/estudio' },
  { label: 'Perfil', icon: 'i-lucide-user', to: '/perfil' },
]
const active = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
</script>

<template>
  <nav
    class="border-default bg-default/90 sticky bottom-0 z-20 flex border-t pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur"
  >
    <NuxtLink
      v-for="it in items"
      :key="it.to"
      :to="it.to"
      class="flex flex-1 flex-col items-center gap-1 pt-2.5"
    >
      <UIcon :name="it.icon" class="size-5" :class="active(it.to) ? 'text-primary' : 'text-dimmed'" />
      <span
        class="text-[0.65rem] font-medium"
        :class="active(it.to) ? 'text-default' : 'text-dimmed'"
        >{{ it.label }}</span
      >
    </NuxtLink>
  </nav>
</template>
