<script setup lang="ts">
import { initials } from '~~/lib/format'

const route = useRoute()
const user = useCurrentUser()
const { client } = useCurrentClient()
const { signOut } = useAuth()
const { forBarberOnDay } = useAppointments()

const items = [
  { label: 'Mi día', icon: 'i-lucide-layout-dashboard', to: '/staff' },
  { label: 'Mi agenda', icon: 'i-lucide-calendar-days', to: '/staff/agenda' },
  { label: 'Mis clientes', icon: 'i-lucide-users', to: '/staff/clientes' },
  { label: 'Mis ingresos', icon: 'i-lucide-euro', to: '/staff/ingresos' },
  { label: 'Mi perfil', icon: 'i-lucide-user', to: '/staff/perfil' },
]
const isActive = (to: string) => (to === '/staff' ? route.path === '/staff' : route.path.startsWith(to))
const name = computed(() => client.value?.name || user.value?.displayName || 'Barbero')
const { name: studioName } = useStudio()

// Badge de citas de hoy.
const today = ref(new Date())
const uid = computed(() => user.value?.uid ?? '')
const todayAppts = forBarberOnDay(uid.value || '__none__', today.value)
const todayCount = computed(() => todayAppts.value.filter((a) => a.status !== 'cancelled').length)
</script>

<template>
  <aside class="border-default bg-muted sticky top-0 hidden h-dvh w-62 shrink-0 flex-col border-r lg:flex">
    <div class="border-default flex h-18 items-center gap-2.5 border-b px-5">
      <AppLogo variant="mark" :size="22" />
      <span class="font-display truncate text-base leading-none">{{ studioName }}</span>
      <span class="bg-border h-5 w-px" />
      <span class="text-dimmed font-mono text-[0.6rem] tracking-[0.15em] uppercase">Barbero</span>
    </div>

    <nav class="flex-1 space-y-0.5 overflow-y-auto p-3.5">
      <p class="text-dimmed px-3 pt-1.5 pb-2 font-mono text-[0.55rem] tracking-[0.15em] uppercase">Mi espacio</p>
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
        <span v-if="it.to === '/staff' && todayCount" class="text-primary bg-primary/15 border-primary/30 ml-auto rounded-md border px-1.5 font-mono text-[0.65rem]">{{ todayCount }}</span>
      </NuxtLink>
    </nav>

    <!-- nota de rol reducido -->
    <div class="border-default bg-accented m-3.5 rounded-xl border border-dashed p-3.5">
      <div class="mb-1.5 flex items-center gap-2">
        <UIcon name="i-lucide-lock" class="text-dimmed size-3.5" />
        <span class="text-toned text-xs font-semibold">Rol Barbero</span>
      </div>
      <p class="text-dimmed text-[0.7rem] leading-snug">La carta, el equipo y los ajustes del local los gestiona el administrador.</p>
    </div>

    <div class="border-default flex items-center gap-3 border-t px-5 py-3.5">
      <div class="border-primary/40 bg-elevated flex size-9 items-center justify-center rounded-full border text-xs font-semibold">{{ initials(name) }}</div>
      <div class="min-w-0 flex-1">
        <p class="truncate text-[0.8rem] font-semibold">{{ name }}</p>
        <p class="text-dimmed truncate text-[0.7rem]">Barbero</p>
      </div>
      <button type="button" aria-label="Salir" class="text-dimmed hover:text-error" @click="signOut">
        <UIcon name="i-lucide-log-out" class="size-[18px]" />
      </button>
    </div>
  </aside>
</template>
