<script setup lang="ts">
import { initials, fmtDate, formatPrice } from '~~/lib/format'
import { toDate } from '~~/lib/datetime'
import type { Client } from '~~/schemas'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Clientes · Admin' })

const { clients } = useClients()
const { services } = useServices()
const { barbers } = useBarbers()
const { forClient } = useAppointments()

// Último acceso (users_v2/{uid}.lastLogin). Puede no existir (cuentas antiguas).
function lastSeen(c: Client): string {
  if (!c.lastLogin) return '—'
  return fmtDate(toDate(c.lastLogin), 'd MMM yyyy · HH:mm')
}

const search = ref('')
const roleFilter = ref<'all' | 'client' | 'barber' | 'admin'>('all')

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return clients.value
    .filter((c) => (roleFilter.value === 'all' ? true : (c.role ?? 'client') === roleFilter.value))
    .filter((c) =>
      !q
        ? true
        : c.name?.toLowerCase().includes(q) ||
          c.email?.toLowerCase().includes(q) ||
          c.phone?.includes(q),
    )
    .sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
})

// Ficha seleccionada + su historial.
const selectedId = ref<string | null>(null)
const selectedIdRef = computed(() => selectedId.value)
const selected = computed(() => clients.value.find((c) => c.id === selectedId.value) ?? null)
const history = forClient(selectedIdRef)
const { enabled: loyaltyEnabled, forClient: loyaltyForClient } = useLoyalty()
const { summary: loyaltySummary } = loyaltyForClient(selectedIdRef)

const enrichedHistory = computed(() =>
  history.value
    .map((a) => {
      const svc = services.value.find((s) => s.id === a.serviceId)
      const bb = barbers.value.find((b) => b.id === a.barberId)
      return {
        ...a,
        startsAt: toDate(a.startsAt),
        serviceName: svc?.name ?? 'Servicio',
        barberName: bb?.name ?? 'Barbero',
        price: a.priceSnapshot ?? svc?.basePrice ?? 0,
      }
    })
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime()),
)
const stats = computed(() => {
  const done = enrichedHistory.value.filter((a) => a.status === 'completed')
  return {
    total: enrichedHistory.value.length,
    done: done.length,
    spent: done.reduce((s, a) => s + a.price, 0),
  }
})

interface RoleBadge {
  label: string
  class: string
}
const roleMeta: Record<string, RoleBadge> = {
  client: { label: 'Cliente', class: 'text-muted bg-elevated' },
  barber: { label: 'Barbero', class: 'text-primary bg-primary/15' },
  admin: { label: 'Admin', class: 'text-warning bg-warning/15' },
}
const ROLE_FALLBACK: RoleBadge = { label: 'Cliente', class: 'text-muted bg-elevated' }
function roleOf(c: Client): RoleBadge {
  return roleMeta[c.role ?? 'client'] ?? ROLE_FALLBACK
}

const bookingOpen = ref(false)
function newApptFor(id: string) {
  selectedId.value = id
  bookingOpen.value = true
}
</script>

<template>
  <div>
    <AdminHeader title="Clientes" :sub="`${filtered.length} personas`" />

    <div class="space-y-4 px-5 py-5 pb-24 lg:px-7 lg:pb-6">
      <div class="flex flex-wrap items-center gap-3">
        <UInput v-model="search" placeholder="Buscar por nombre, email o teléfono…" icon="i-lucide-search" size="lg" class="max-w-sm flex-1" />
        <div class="border-default flex overflow-hidden rounded-xl border text-sm">
          <button
            v-for="r in (['all', 'client', 'barber', 'admin'] as const)"
            :key="r"
            type="button"
            class="border-default border-r px-3 py-2 font-medium capitalize last:border-r-0"
            :class="roleFilter === r ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-elevated'"
            @click="roleFilter = r"
          >
            {{ r === 'all' ? 'Todos' : roleMeta[r]?.label }}
          </button>
        </div>
      </div>

      <!-- tabla / lista -->
      <div class="border-default overflow-hidden rounded-2xl border">
        <div class="text-dimmed bg-muted hidden grid-cols-[2fr_1.5fr_1fr_1.3fr_auto] gap-3 px-4 py-2.5 font-mono text-[0.6rem] tracking-widest uppercase lg:grid">
          <span>Nombre</span><span>Email</span><span>Teléfono</span><span>Último acceso</span><span>Rol</span>
        </div>
        <button
          v-for="c in filtered"
          :key="c.id"
          type="button"
          class="border-default hover:bg-elevated grid w-full grid-cols-[1fr_auto] items-center gap-3 border-t px-4 py-3 text-left first:border-t-0 lg:grid-cols-[2fr_1.5fr_1fr_1.3fr_auto] lg:first:border-t-0"
          @click="selectedId = c.id"
        >
          <span class="flex min-w-0 items-center gap-3">
            <span class="bg-elevated border-default flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">{{ initials(c.name) }}</span>
            <span class="min-w-0"><span class="block truncate text-sm font-semibold">{{ c.name || 'Sin nombre' }}</span><span class="text-dimmed block truncate text-xs lg:hidden">{{ c.email }}</span></span>
          </span>
          <span class="text-muted hidden truncate text-sm lg:block">{{ c.email }}</span>
          <span class="text-muted hidden font-mono text-sm lg:block">{{ c.phone || '—' }}</span>
          <span class="text-dimmed hidden truncate text-xs lg:block">{{ lastSeen(c) }}</span>
          <span class="rounded-full px-2 py-0.5 text-center font-mono text-[0.55rem] tracking-wide uppercase" :class="roleOf(c).class">{{ roleOf(c).label }}</span>
        </button>
        <div v-if="!filtered.length" class="py-10">
          <UiEmptyState icon="i-lucide-users" title="Sin resultados" description="Prueba con otra búsqueda." />
        </div>
      </div>
    </div>

    <!-- ficha (drawer) -->
    <Transition enter-active-class="transition-opacity" leave-active-class="transition-opacity" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="selected" class="fixed inset-0 z-50 flex justify-end" @click="selectedId = null">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <aside class="border-default bg-default relative flex h-full w-full max-w-md flex-col overflow-hidden border-l" @click.stop>
          <header class="border-default flex items-center justify-between border-b px-5 py-4">
            <span class="font-display text-lg">Ficha de cliente</span>
            <button type="button" aria-label="Cerrar" class="text-muted flex size-8 items-center justify-center" @click="selectedId = null"><UIcon name="i-lucide-x" class="size-5" /></button>
          </header>

          <div class="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div class="flex items-center gap-4">
              <div class="border-primary/40 bg-elevated flex size-16 items-center justify-center rounded-full border text-lg font-semibold">{{ initials(selected.name) }}</div>
              <div class="min-w-0">
                <p class="font-display truncate text-2xl leading-none">{{ selected.name || 'Sin nombre' }}</p>
                <span class="mt-1.5 inline-block rounded-full px-2 py-0.5 font-mono text-[0.55rem] tracking-wide uppercase" :class="roleOf(selected).class">{{ roleOf(selected).label }}</span>
              </div>
            </div>

            <div class="border-default bg-muted space-y-2.5 rounded-2xl border p-4">
              <div class="flex items-center gap-3"><UIcon name="i-lucide-mail" class="text-muted size-4" /><span class="truncate text-sm">{{ selected.email || '—' }}</span></div>
              <div class="flex items-center gap-3"><UIcon name="i-lucide-phone" class="text-muted size-4" /><span class="font-mono text-sm">{{ selected.phone || '—' }}</span></div>
              <div v-if="selected.instagram" class="flex items-center gap-3"><UIcon name="i-lucide-instagram" class="text-muted size-4" /><span class="text-sm">@{{ selected.instagram }}</span></div>
              <div class="flex items-center gap-3"><UIcon name="i-lucide-clock" class="text-muted size-4" /><span class="text-sm">Último acceso: {{ lastSeen(selected) }}</span></div>
            </div>

            <div class="grid grid-cols-3 gap-2.5">
              <div class="border-default bg-muted rounded-xl border p-3 text-center"><p class="font-display text-2xl">{{ stats.total }}</p><p class="text-dimmed font-mono text-[0.55rem] uppercase">citas</p></div>
              <div class="border-default bg-muted rounded-xl border p-3 text-center"><p class="font-display text-2xl">{{ stats.done }}</p><p class="text-dimmed font-mono text-[0.55rem] uppercase">hechas</p></div>
              <div class="border-default bg-muted rounded-xl border p-3 text-center"><p class="font-display text-primary text-2xl">{{ formatPrice(stats.spent) }}</p><p class="text-dimmed font-mono text-[0.55rem] uppercase">gastado</p></div>
            </div>

            <!-- fidelización (si el programa está activo) -->
            <div v-if="loyaltyEnabled" class="border-primary/30 flex items-center justify-between rounded-xl border p-4" style="background: linear-gradient(135deg, var(--jdvm-bg-2), var(--jdvm-bg-1))">
              <div class="flex items-center gap-2.5">
                <UIcon name="i-lucide-award" class="text-primary size-5" />
                <div>
                  <p class="text-sm font-semibold">Socio · {{ loyaltySummary.tier.name }}</p>
                  <p class="text-dimmed text-xs">{{ loyaltySummary.earned }} pts ganados</p>
                </div>
              </div>
              <div class="text-right">
                <p class="font-display text-2xl leading-none">{{ loyaltySummary.balance }}</p>
                <p class="text-dimmed font-mono text-[0.55rem] uppercase">disponibles</p>
              </div>
            </div>

            <div>
              <h3 class="font-display mb-2.5 text-lg">Historial</h3>
              <div v-if="enrichedHistory.length" class="space-y-2">
                <div v-for="a in enrichedHistory" :key="a.id" class="border-default bg-muted flex items-center gap-3 rounded-xl border p-3">
                  <div class="text-center"><p class="font-display text-base leading-none capitalize">{{ fmtDate(a.startsAt, 'd MMM') }}</p><p class="text-dimmed font-mono text-[0.6rem]">{{ fmtDate(a.startsAt, 'HH:mm') }}</p></div>
                  <div class="min-w-0 flex-1"><p class="truncate text-sm font-medium">{{ a.serviceName }}</p><p class="text-dimmed truncate text-xs">{{ a.barberName }}</p></div>
                  <span class="font-display text-base">{{ formatPrice(a.price) }}</span>
                </div>
              </div>
              <UiEmptyState v-else icon="i-lucide-calendar" title="Sin historial" description="Este cliente aún no tiene citas." />
            </div>
          </div>

          <footer class="border-default border-t px-5 py-4">
            <UButton color="primary" size="lg" block icon="i-lucide-plus" @click="newApptFor(selected.id)">Crear cita</UButton>
          </footer>
        </aside>
      </div>
    </Transition>

    <AdminBookingModal v-model:open="bookingOpen" :preset-client-id="selectedId ?? undefined" />
  </div>
</template>
