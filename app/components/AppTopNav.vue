<script setup lang="ts">
import { initials } from '~~/lib/format'

// Barra de navegación superior del cliente en escritorio (lg+). En móvil se usa
// AppTabBar. Réplica del mockup CWClientNav: logo + enlaces + campana + ficha.
const route = useRoute()
const user = useCurrentUser()
const { client } = useCurrentClient()
const { signOut } = useAuth()
const { unreadMine } = useNotifications()
const { active: alerts } = useAlerts()
const { enabled: loyaltyEnabled } = useLoyalty()
const { name: studioName } = useStudio()

const items = [
  { label: 'Inicio', to: '/app' },
  { label: 'Reservar', to: '/reservar' },
  { label: 'El estudio', to: '/estudio' },
  { label: 'Mi cuenta', to: '/perfil' },
]
const isActive = (to: string) => route.path === to || route.path.startsWith(`${to}/`)

const name = computed(() => client.value?.name || user.value?.displayName || 'Cliente')
const firstName = computed(() => name.value.split(' ')[0])
const hasNews = computed(() => unreadMine.value > 0 || alerts.value.length > 0)

const menuItems = computed(() => [
  [
    { label: 'Mi cuenta', icon: 'i-lucide-user', to: '/perfil' },
    ...(loyaltyEnabled.value ? [{ label: 'Socio', icon: 'i-lucide-award', to: '/socio' }] : []),
    { label: 'Avisos', icon: 'i-lucide-bell', to: '/avisos' },
  ],
  [
    { label: 'Carta de servicios', icon: 'i-lucide-book-open', to: '/carta' },
    { label: 'Lista de espera', icon: 'i-lucide-clock', to: '/lista-espera' },
  ],
  [{ label: 'Cerrar sesión', icon: 'i-lucide-log-out', color: 'error' as const, onSelect: () => signOut() }],
])
</script>

<template>
  <header
    class="border-default bg-default/85 sticky top-0 z-30 h-19 shrink-0 border-b backdrop-blur-md"
  >
    <div class="mx-auto flex h-full w-full max-w-[1280px] items-center gap-6 px-8">
      <NuxtLink to="/app" class="flex items-center gap-2.5" :aria-label="`${studioName} · Inicio`">
        <AppLogo variant="mark" :size="24" />
        <span class="font-display text-lg leading-none">{{ studioName }}</span>
      </NuxtLink>

      <nav class="ml-3 flex items-center gap-7">
        <NuxtLink
          v-for="it in items"
          :key="it.to"
          :to="it.to"
          class="relative pb-1 text-sm transition-colors"
          :class="isActive(it.to) ? 'text-default border-primary border-b-2 font-semibold' : 'text-toned hover:text-default border-b-2 border-transparent font-medium'"
        >
          {{ it.label }}
        </NuxtLink>
      </nav>

      <div class="flex-1" />

      <NuxtLink
        to="/avisos"
        class="border-default bg-muted text-toned hover:text-default relative flex size-10 items-center justify-center rounded-xl border transition-colors"
        aria-label="Avisos"
      >
        <UIcon name="i-lucide-bell" class="size-[18px]" />
        <span
          v-if="hasNews"
          class="bg-primary ring-muted absolute top-2 right-2 size-[7px] rounded-full ring-2"
        />
      </NuxtLink>

      <UDropdownMenu :items="menuItems" :ui="{ content: 'min-w-44' }">
        <button
          type="button"
          class="border-default bg-muted hover:bg-elevated flex items-center gap-2.5 rounded-full border py-[5px] pr-3.5 pl-[5px] transition-colors"
        >
          <span class="border-primary/40 bg-elevated flex size-[30px] items-center justify-center rounded-full border text-[0.7rem] font-semibold">
            {{ initials(name) }}
          </span>
          <span class="text-default text-[0.85rem] font-semibold">{{ firstName }}</span>
          <UIcon name="i-lucide-chevron-down" class="text-dimmed size-3.5" />
        </button>
      </UDropdownMenu>
    </div>
  </header>
</template>
