<script setup lang="ts">
import { fmtDate, formatPrice, initials, dayLetterEs } from '~~/lib/format'
import { toDate, sameDay } from '~~/lib/datetime'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Resumen · Admin' })

const { onDay } = useAppointments()
const { active: barbers } = useBarbers()
const { clients } = useClients()

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
const today = ref(startOfToday())
const yesterday = computed(() => {
  const d = new Date(today.value)
  d.setDate(d.getDate() - 1)
  return d
})

const todayRaw = onDay(today)
const yesterdayRaw = onDay(yesterday)
const { enriched } = useAdminAppointments(todayRaw)

const now = useClientNow()
function useClientNow() {
  const n = ref(new Date())
  if (import.meta.client) {
    const id = setInterval(() => (n.value = new Date()), 60_000)
    onScopeDispose(() => clearInterval(id))
  }
  return n
}

const live = computed(() =>
  enriched.value
    // Los bloqueos de hueco no son citas: fuera del panel de negocio (KPIs, timeline).
    .filter((a) => a.status !== 'cancelled' && a.type !== 'block')
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
)
const valid = computed(() => live.value.filter((a) => a.status === 'booked' || a.status === 'completed'))

const yCount = computed(() => yesterdayRaw.value.filter((a) => a.status !== 'cancelled' && a.type !== 'block').length)

const kpis = computed(() => {
  const revenue = valid.value.reduce((s, a) => s + a.price, 0)
  const upcoming = valid.value.filter((a) => a.startsAt.getTime() > now.value.getTime()).length
  const newClients = clients.value.filter((c) => {
    const ca = c.createdAt ? toDate(c.createdAt) : null
    return ca ? sameDay(ca, today.value) : false
  }).length
  const deltaC = live.value.length - yCount.value
  return { count: live.value.length, revenue, upcoming, newClients, deltaC }
})

const nextId = computed(
  () => valid.value.find((a) => a.endsAt.getTime() > now.value.getTime())?.id ?? null,
)

// — Ingresos de la semana (lun–dom) —
const weekStart = computed(() => {
  const d = new Date(today.value)
  const dow = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - dow)
  return d
})
const weekEnd = computed(() => {
  const d = new Date(weekStart.value)
  d.setDate(d.getDate() + 7)
  return d
})
const { perDay, totals } = useAdminStats(weekStart, weekEnd)
const { sales } = useProductSales()

// Ventas de producto de la semana actual, agrupadas por día (ingreso = precio·uds).
const weekSales = computed(() =>
  sales.value.filter((s) => {
    const t = toDate(s.soldAt).getTime()
    return t >= weekStart.value.getTime() && t < weekEnd.value.getTime()
  }),
)
// Ingreso del día = citas HECHAS (perDay, solo completed) + venta de productos.
const perDayTotal = computed(() =>
  perDay.value.map((d) => {
    const products = weekSales.value
      .filter((s) => sameDay(toDate(s.soldAt), d.date))
      .reduce((sum, s) => sum + s.unitPrice * s.qty, 0)
    return { ...d, revenue: d.revenue + products }
  }),
)
const productRevenue = computed(() => weekSales.value.reduce((s, x) => s + x.unitPrice * x.qty, 0))
// Total semanal = servicios hechos + productos.
const weekRevenue = computed(() => totals.value.revenue + productRevenue.value)
const maxRev = computed(() => Math.max(1, ...perDayTotal.value.map((d) => d.revenue)))

// — Equipo hoy —
const teamToday = computed(() =>
  barbers.value
    .map((b) => ({
      barber: b,
      count: valid.value.filter((a) => a.barberId === b.id).length,
    }))
    .sort((a, b) => b.count - a.count),
)

type PillKind = 'confirmed' | 'done' | 'pending' | 'cancelled' | 'neutral'
function statusKind(s: string): PillKind {
  if (s === 'completed') return 'done'
  if (s === 'no_show') return 'cancelled'
  return 'confirmed'
}
function statusLabel(s: string) {
  return s === 'completed' ? 'Hecha' : s === 'no_show' ? 'No vino' : 'Confirmada'
}

const subtitle = computed(() => `${fmtDate(today.value, "EEEE d 'de' MMMM")} · vista general del día`)

const bookingOpen = ref(false)
</script>

<template>
  <div>
    <AdminHeader title="Resumen" :sub="subtitle">
      <template #actions>
        <UButton color="primary" icon="i-lucide-plus" @click="bookingOpen = true">Nueva cita</UButton>
      </template>
    </AdminHeader>

    <div class="space-y-4 px-5 py-6 pb-24 lg:px-7 lg:pb-6">
      <!-- KPIs -->
      <div class="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <AdminKpi icon="i-lucide-calendar" label="Citas hoy" :value="kpis.count" :delta="kpis.deltaC >= 0 ? `+${kpis.deltaC}` : `${kpis.deltaC}`" :up="kpis.deltaC >= 0" />
        <AdminKpi icon="i-lucide-euro" label="Ingresos hoy" :value="formatPrice(kpis.revenue)" />
        <AdminKpi icon="i-lucide-clock" label="Próximas hoy" :value="kpis.upcoming" />
        <AdminKpi icon="i-lucide-users" label="Clientes nuevos" :value="kpis.newClients" />
      </div>

      <!-- grid principal -->
      <div class="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <!-- próximas citas -->
        <AdminCard :pad="false">
          <div class="border-default flex items-center justify-between border-b px-5 py-4">
            <div>
              <div class="font-display text-lg">Próximas citas</div>
              <div class="text-dimmed mt-0.5 text-xs">Hoy · {{ live.length }} citas programadas</div>
            </div>
            <UButton to="/admin/agenda" color="neutral" variant="ghost" size="sm" icon="i-lucide-calendar-days">Ver agenda</UButton>
          </div>
          <div v-if="live.length" class="px-5 pb-2">
            <div
              v-for="a in live"
              :key="a.id"
              class="border-default flex items-center gap-4 border-b py-3 last:border-b-0"
            >
              <div class="w-12 shrink-0 text-right font-mono text-[0.8rem] font-semibold" :class="nextId === a.id ? 'text-primary' : ''">
                {{ fmtDate(a.startsAt, 'HH:mm') }}
              </div>
              <span class="h-9 w-[3px] shrink-0 rounded-full" :style="{ background: a.barberColor || 'var(--jdvm-accent)' }" />
              <div class="bg-elevated border-default flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">{{ initials(a.clientName) }}</div>
              <div class="min-w-0 flex-1">
                <div class="flex items-center gap-2"><span class="truncate text-sm font-semibold">{{ a.clientName }}</span><ClientInfoButton :name="a.clientName" :phone="a.clientPhone" :email="a.clientEmail" /></div>
                <div class="text-dimmed truncate text-xs">{{ a.serviceName }} · {{ a.barberName }}</div>
              </div>
              <AdminPill :kind="nextId === a.id ? 'confirmed' : statusKind(a.status)">
                {{ nextId === a.id && a.status === 'booked' ? 'En curso' : statusLabel(a.status) }}
              </AdminPill>
            </div>
          </div>
          <div v-else class="p-6">
            <UiEmptyState icon="i-lucide-calendar-x" title="Sin citas hoy" description="No hay reservas para hoy." />
          </div>
        </AdminCard>

        <!-- columna derecha -->
        <div class="space-y-4">
          <!-- ingresos semana -->
          <AdminCard>
            <div class="flex items-baseline justify-between">
              <div class="font-display text-lg">Ingresos semana</div>
              <span class="text-dimmed font-mono text-xs">{{ formatPrice(weekRevenue) }}</span>
            </div>
            <p class="text-dimmed mt-0.5 text-[0.7rem]">Citas hechas + productos · semana actual</p>
            <div class="mt-5 flex h-28 items-end gap-2.5">
              <div v-for="d in perDayTotal" :key="d.label" class="flex flex-1 flex-col items-center gap-2">
                <div class="flex h-24 w-full items-end">
                  <div
                    class="w-full rounded-[5px] border"
                    :class="d.revenue === maxRev ? 'bg-primary border-primary' : 'bg-primary/15 border-primary/30'"
                    :style="{ height: `${d.revenue ? Math.max(6, (d.revenue / maxRev) * 100) : 0}%` }"
                  />
                </div>
                <span class="font-mono text-[0.65rem]" :class="d.revenue === maxRev ? 'text-primary' : 'text-dimmed'">{{ dayLetterEs(d.date) }}</span>
              </div>
            </div>
          </AdminCard>

          <!-- equipo hoy -->
          <AdminCard :pad="false">
            <div class="border-default flex items-center justify-between border-b px-5 py-4">
              <div class="font-display text-lg">Equipo hoy</div>
              <span class="text-dimmed font-mono text-xs">{{ barbers.length }} activos</span>
            </div>
            <div class="px-5 pb-2">
              <div v-for="r in teamToday" :key="r.barber.id" class="border-default flex items-center gap-3 border-b py-3 last:border-b-0">
                <div class="bg-elevated flex size-9 items-center justify-center rounded-full border text-xs font-semibold" :style="{ borderColor: r.barber.color }">{{ initials(r.barber.name) }}</div>
                <div class="flex-1">
                  <div class="text-sm font-semibold">{{ r.barber.name }}</div>
                  <div class="text-dimmed text-xs">{{ r.count }} citas hoy</div>
                </div>
                <AdminPill :kind="r.count ? 'confirmed' : 'neutral'">{{ r.count ? 'Ocupado' : 'Libre' }}</AdminPill>
              </div>
            </div>
          </AdminCard>
        </div>
      </div>
    </div>

    <AdminFab label="Nueva cita" @click="bookingOpen = true" />
    <AdminBookingModal v-model:open="bookingOpen" :preset-date="today" />
  </div>
</template>
