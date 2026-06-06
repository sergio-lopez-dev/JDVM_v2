<script setup lang="ts">
import { initials } from '~~/lib/format'

const route = useRoute()
const user = useCurrentUser()
const { client } = useCurrentClient()
const { signOut } = useAuth()
const { unreadMine } = useNotifications()

const items = [
  { label: 'Inicio', icon: 'i-lucide-house', to: '/app' },
  { label: 'Reservar', icon: 'i-lucide-scissors', to: '/reservar' },
  { label: 'Estudio', icon: 'i-lucide-layout-grid', to: '/estudio' },
  { label: 'Carta', icon: 'i-lucide-book-open', to: '/carta' },
  { label: 'Avisos', icon: 'i-lucide-bell', to: '/avisos' },
  { label: 'Perfil', icon: 'i-lucide-user', to: '/perfil' },
]
const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`)
const name = computed(() => client.value?.name || user.value?.displayName || 'Cliente')
const email = computed(() => client.value?.email || user.value?.email || '')
</script>

<template>
  <aside class="border-default bg-muted sticky top-0 hidden h-dvh w-62 shrink-0 flex-col border-r lg:flex">
    <NuxtLink to="/app" class="border-default flex h-18 items-center gap-2.5 border-b px-5">
      <AppLogo variant="mark" :size="24" />
      <AppLogo variant="wordmark" :size="18" />
    </NuxtLink>

    <nav class="flex-1 space-y-0.5 overflow-y-auto p-3.5">
      <NuxtLink
        v-for="it in items"
        :key="it.to"
        :to="it.to"
        class="relative flex items-center gap-3 rounded-[10px] border px-3 py-2.5 text-sm transition-colors"
        :class="isActive(it.to) ? 'border-primary/30 bg-primary/10 text-default font-semibold' : 'text-toned hover:bg-elevated border-transparent font-medium'"
      >
        <span v-if="isActive(it.to)" class="bg-primary absolute top-1/2 -left-3.5 h-5 w-[3px] -translate-y-1/2 rounded-full" />
        <UIcon :name="it.icon" class="size-[18px] shrink-0" :class="isActive(it.to) ? 'text-primary' : 'text-dimmed'" />
        {{ it.label }}
        <span v-if="it.to === '/avisos' && unreadMine" class="bg-primary ml-auto size-2 rounded-full" />
      </NuxtLink>
    </nav>

    <div class="px-3.5 pb-2">
      <UButton to="/reservar" color="primary" size="lg" block icon="i-lucide-scissors" class="justify-center">Reservar cita</UButton>
    </div>

    <div class="border-default flex items-center gap-3 border-t px-5 py-3.5">
      <div class="border-primary/40 bg-elevated flex size-9 items-center justify-center rounded-full border text-xs font-semibold">{{ initials(name) }}</div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-[0.8rem] font-semibold">{{ name }}</p>
        <p class="text-dimmed truncate text-[0.7rem]">{{ email }}</p>
      </div>
      <button type="button" aria-label="Salir" class="text-dimmed hover:text-error" @click="signOut">
        <UIcon name="i-lucide-log-out" class="size-[18px]" />
      </button>
    </div>
  </aside>
</template>
