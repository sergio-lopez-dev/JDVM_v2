<script setup lang="ts">
const route = useRoute()

const items = [
  { label: 'Resumen', icon: 'i-lucide-layout-dashboard', to: '/admin' },
  { label: 'Agenda', icon: 'i-lucide-calendar-days', to: '/admin/agenda' },
  { label: 'Citas', icon: 'i-lucide-scissors', to: '/admin/citas' },
  { label: 'Carta', icon: 'i-lucide-store', to: '/admin/catalogo' },
  { label: 'Más', icon: 'i-lucide-ellipsis', to: '/admin/mas' },
]

// Rutas que cuelgan de "Más" (no tienen pestaña propia).
const MORE = ['/admin/mas', '/admin/equipo', '/admin/clientes', '/admin/estudio', '/admin/reports', '/admin/notificaciones', '/admin/ajustes']

function active(to: string) {
  if (to === '/admin') return route.path === '/admin'
  if (to === '/admin/mas') return MORE.some((p) => route.path.startsWith(p))
  return route.path.startsWith(to)
}
</script>

<template>
  <nav class="border-default bg-default/95 sticky bottom-0 z-30 flex border-t pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur lg:hidden">
    <NuxtLink
      v-for="it in items"
      :key="it.to"
      :to="it.to"
      class="flex flex-1 flex-col items-center gap-1 pt-2.5"
    >
      <UIcon :name="it.icon" class="size-[21px]" :class="active(it.to) ? 'text-primary' : 'text-dimmed'" />
      <span class="text-[0.65rem]" :class="active(it.to) ? 'text-default font-semibold' : 'text-dimmed font-medium'">{{ it.label }}</span>
    </NuxtLink>
  </nav>
</template>
