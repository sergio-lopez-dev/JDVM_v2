<script setup lang="ts">
import { initials } from '~~/lib/format'
import { resolveDayTimetable } from '~~/lib/slots'

const route = useRoute()
const user = useCurrentUser()
const { client } = useCurrentClient()
const { signOut } = useAuth()
const { settings } = useSettings()
const { onDay } = useAppointments()

const isActive = (to: string) =>
  to === '/admin' ? route.path === '/admin' : route.path.startsWith(to)

const adminName = computed(() => client.value?.name || user.value?.displayName || 'Admin')
const adminEmail = computed(() => client.value?.email || user.value?.email || '')

const { studio } = useStudio()
const studioLine = computed(() =>
  [studio.value.name, studio.value.address || studio.value.city].filter(Boolean).join(' · '),
)

// Citas de hoy → badge + estado.
const today = ref(new Date())
const todayAppts = onDay(today)
const todayCount = computed(
  () => todayAppts.value.filter((a) => a.status !== 'cancelled').length,
)

// Estado del local (abierto/cerrado) según el horario de settings.
const now = useClientNow()
const shop = computed(() => {
  const dt = settings.value ? resolveDayTimetable(settings.value.timetable, now.value) : undefined
  if (!dt) return { open: false, closes: '' }
  const hm = (s: string) => {
    const [h, m] = s.split(':').map(Number)
    const d = new Date(now.value)
    d.setHours(h ?? 0, m ?? 0, 0, 0)
    return d
  }
  const windows = [dt.morning, dt.afternoon].filter(Boolean) as { start: string; end: string }[]
  for (const w of windows) {
    if (now.value >= hm(w.start) && now.value <= hm(w.end)) return { open: true, closes: w.end }
  }
  return { open: false, closes: windows.at(-1)?.end ?? '' }
})

function useClientNow() {
  const n = ref(new Date())
  if (import.meta.client) {
    const id = setInterval(() => (n.value = new Date()), 60_000)
    onScopeDispose(() => clearInterval(id))
  }
  return n
}
</script>

<template>
  <div class="bg-default text-default flex min-h-dvh font-sans antialiased">
    <!-- SIDEBAR (desktop) -->
    <aside class="border-default bg-muted sticky top-0 hidden h-dvh w-62 shrink-0 flex-col border-r lg:flex">
      <div class="border-default flex h-18 items-center gap-3 border-b px-5">
        <AppLogo variant="mark" :size="22" />
        <span class="font-display truncate text-base leading-none">{{ studio.name }}</span>
        <span class="bg-border h-5 w-px" />
        <span class="text-dimmed font-mono text-[0.6rem] tracking-[0.15em] uppercase">Panel</span>
      </div>

      <nav class="flex-1 space-y-0.5 overflow-y-auto p-3.5">
        <p class="text-dimmed px-3 pt-1.5 pb-2 font-mono text-[0.55rem] tracking-[0.15em] uppercase">
          Gestión
        </p>
        <NuxtLink
          v-for="it in ADMIN_NAV"
          :key="it.to"
          :to="it.to"
          class="relative flex items-center gap-3 rounded-[10px] border px-3 py-2.5 text-sm transition-colors"
          :class="
            isActive(it.to)
              ? 'border-primary/30 bg-primary/10 text-default font-semibold'
              : 'text-toned hover:bg-elevated border-transparent font-medium'
          "
        >
          <span
            v-if="isActive(it.to)"
            class="bg-primary absolute top-1/2 -left-3.5 h-5 w-[3px] -translate-y-1/2 rounded-full"
          />
          <UIcon :name="it.icon" class="size-[18px] shrink-0" :class="isActive(it.to) ? 'text-primary' : 'text-dimmed'" />
          {{ it.label }}
          <span
            v-if="it.to === '/admin/citas' && todayCount"
            class="text-primary bg-primary/15 border-primary/30 ml-auto rounded-md border px-1.5 font-mono text-[0.65rem]"
            >{{ todayCount }}</span
          >
        </NuxtLink>
      </nav>

      <!-- estado del local -->
      <div class="border-default bg-accented m-3.5 rounded-xl border p-3.5">
        <div class="flex items-center gap-2">
          <span
            class="size-2 rounded-full"
            :class="shop.open ? 'bg-success' : ''"
            :style="shop.open ? 'box-shadow: 0 0 0 3px var(--jdvm-accent-soft)' : 'background: var(--jdvm-fg-2)'"
          />
          <span class="text-sm font-semibold">{{ shop.open ? 'Abierto' : 'Cerrado' }}</span>
          <span v-if="shop.closes" class="text-dimmed ml-auto font-mono text-[0.7rem]">{{ shop.closes }}</span>
        </div>
        <p class="text-dimmed mt-2 text-xs leading-snug">{{ studioLine }}</p>
      </div>

      <!-- usuario -->
      <div class="border-default flex items-center gap-3 border-t px-5 py-3.5">
        <div class="border-primary/40 bg-elevated flex size-9 items-center justify-center rounded-full border text-xs font-semibold">
          {{ initials(adminName) }}
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-[0.8rem] font-semibold">{{ adminName }}</p>
          <p class="text-dimmed truncate text-[0.7rem]">{{ adminEmail || 'Administrador' }}</p>
        </div>
        <button type="button" aria-label="Salir" class="text-dimmed hover:text-error" @click="signOut">
          <UIcon name="i-lucide-log-out" class="size-[18px]" />
        </button>
      </div>
    </aside>

    <!-- COLUMNA PRINCIPAL -->
    <div class="flex min-w-0 flex-1 flex-col">
      <main class="min-w-0 flex-1 pb-2 lg:pb-0">
        <slot />
      </main>
      <!-- TAB BAR (móvil) -->
      <AdminTabBar />
    </div>
  </div>
</template>
