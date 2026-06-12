<script setup lang="ts">
// Schedule-X v4 usa `Temporal` como GLOBAL; temporal-polyfill no lo instala al
// importar el named export, así que cargamos el polyfill global ANTES que
// @schedule-x (el orden de imports importa) o el módulo peta con
// "Temporal is not defined" (cliente y SSR). Debe ir primero.
import 'temporal-polyfill/global'
import { ScheduleXCalendar } from '@schedule-x/vue'
import {
  createCalendar,
  createViewWeek,
  createViewDay,
  createViewMonthGrid,
  createViewList,
  type CalendarApp,
  type CalendarEvent,
} from '@schedule-x/calendar'
import '@schedule-x/theme-default/dist/index.css'
import { toZdt, fromTemporal, STUDIO_TZ } from '~~/lib/schedulex'
import { fmtDate, formatPrice, initials } from '~~/lib/format'
import { sameDay } from '~~/lib/datetime'
import { isCancellable } from '~~/lib/cancellation'
import { freeWindows, resolveDayTimetable } from '~~/lib/slots'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Agenda · Admin' })

const { inRange, setStatus, cancel, remove } = useAppointments()
const { active: barbers } = useBarbers()
const { settings } = useSettings()
const { notifyCancellation } = useNotifications()
const { setBanned, clientById } = useClients()
const toast = useToast()

// Rango consultado a Firestore (lo mueve Schedule-X vía onRangeUpdate).
function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const dow = (x.getDay() + 6) % 7 // lunes = 0
  x.setDate(x.getDate() - dow)
  return x
}
const rangeStart = ref(startOfWeek(new Date()))
const rangeEnd = ref(new Date(startOfWeek(new Date()).getTime() + 7 * 86_400_000))

const appts = inRange(rangeStart, rangeEnd)
const { enriched } = useAdminAppointments(appts)

// Estado de carga (VueFire expone `.pending` en useCollection) para no mostrar
// la agenda en blanco mientras llegan los datos de Firestore.
const loading = computed(() => appts.pending.value)

// Filtro por barbero (chips). null = todos.
const barberFilter = ref<string | null>(null)
const visible = computed(() =>
  barberFilter.value ? enriched.value.filter((a) => a.barberId === barberFilter.value) : enriched.value,
)

// Citas -> eventos Schedule-X (excluye canceladas).
const events = computed<CalendarEvent[]>(() =>
  visible.value
    .filter((a) => a.status !== 'cancelled')
    .map((a) => ({
      id: a.id,
      title: `${a.clientName} · ${a.serviceName}`,
      start: toZdt(a.startsAt),
      end: toZdt(a.endsAt),
      calendarId: a.barberId,
      people: [a.barberName],
    })),
)

// Color por barbero para Schedule-X.
const calendars = computed(() =>
  Object.fromEntries(
    barbers.value.map((b) => [
      b.id,
      {
        colorName: b.id,
        label: b.name,
        lightColors: { main: b.color, container: b.color, onContainer: '#0B0F0C' },
        darkColors: { main: b.color, container: `${b.color}33`, onContainer: '#F2F1EC' },
      },
    ]),
  ),
)

const calendarApp = shallowRef<CalendarApp | null>(null)
const selected = ref<(typeof enriched.value)[number] | null>(null)

// Veto del cliente de la cita seleccionada (para ofrecer vetar tras un "no vino").
const selectedClientId = computed(() => selected.value?.clientId ?? null)
const selectedClientDoc = clientById(selectedClientId)
const selectedBanned = computed(() => !!selectedClientDoc.value?.banned)
const banPrompt = ref(false)
const banBusy = ref(false)
// Resetea el prompt al cambiar DE cita (por id): así reflejar el nuevo estado de la
// misma cita (spread con status no_show) no lo cierra.
watch(() => selected.value?.id, () => (banPrompt.value = false))

onMounted(() => {
  calendarApp.value = createCalendar({
    // Día / Semana / Mes / Lista — el selector superior permite cambiar de vista.
    views: [createViewDay(), createViewWeek(), createViewMonthGrid(), createViewList()],
    defaultView: 'week',
    locale: 'es-ES',
    firstDayOfWeek: 1,
    timezone: STUDIO_TZ,
    isDark: true,
    dayBoundaries: { start: '09:00', end: '23:00' },
    weekOptions: { gridHeight: 720 },
    monthGridOptions: { nEventsPerDay: 4 },
    calendars: calendars.value,
    events: events.value,
    callbacks: {
      onRangeUpdate(range) {
        // Solo actualizamos si el rango cambia de verdad: asignar un Date nuevo
        // en cada render dispararía un bucle reactivo (eventos → set → render).
        const s = fromTemporal(range.start)
        const e = fromTemporal(range.end)
        if (s.getTime() !== rangeStart.value.getTime()) rangeStart.value = s
        if (e.getTime() !== rangeEnd.value.getTime()) rangeEnd.value = e
      },
      onEventClick(ev) {
        selected.value = enriched.value.find((a) => a.id === ev.id) ?? null
      },
    },
  })
})

// Mantener los eventos sincronizados con Firestore.
watch(events, (list) => {
  calendarApp.value?.events?.set(list)
})
// Refrescar colores si cambian barberos.
watch(calendars, () => {
  if (calendarApp.value) calendarApp.value.events.set(events.value)
})

async function markCompleted(id: string) {
  await setStatus(id, 'completed')
  toast.add({ title: 'Cita completada', icon: 'i-lucide-check', color: 'success' })
  selected.value = null
}
async function markNoShow(id: string) {
  await setStatus(id, 'no_show')
  toast.add({ title: 'Marcada como “no vino”', icon: 'i-lucide-user-x', color: 'warning' })
  // Refleja el nuevo estado en el drawer (oculta los botones de 'booked') sin cerrarlo.
  if (selected.value?.id === id) selected.value = { ...selected.value, status: 'no_show' }
  // Ofrece vetar al cliente (no siempre se veta: solo si no paga la cita perdida).
  if (!selectedBanned.value) banPrompt.value = true
}
async function banFromPrompt() {
  if (!selected.value || banBusy.value) return
  banBusy.value = true
  try {
    await setBanned(selected.value.clientId, true)
    toast.add({ title: 'Cliente vetado', description: 'No podrá coger nuevas citas.', icon: 'i-lucide-ban', color: 'warning' })
    banPrompt.value = false
  } catch (e) {
    toast.add({ title: 'No se pudo vetar', description: (e as Error).message, color: 'error' })
  } finally {
    banBusy.value = false
  }
}
async function cancelAppt() {
  if (!selected.value) return
  try {
    await cancel(selected.value.id, selected.value.startsAt, { isAdmin: true })
    await notifyCancellation({
      barberId: selected.value.barberId,
      clientName: selected.value.clientName,
      serviceName: selected.value.serviceName,
      when: fmtDate(selected.value.startsAt, "EEE d MMM 'a las' HH:mm"),
      appointmentId: selected.value.id,
    })
    toast.add({ title: 'Cita cancelada', icon: 'i-lucide-x', color: 'warning' })
    selected.value = null
  } catch (e) {
    toast.add({ title: 'Error', description: (e as Error).message, color: 'error' })
  }
}
async function deleteAppt() {
  if (!selected.value) return
  await remove(selected.value.id)
  toast.add({ title: 'Cita eliminada', icon: 'i-lucide-trash-2' })
  selected.value = null
}

// — Vista móvil (timeline) —
const selectedDay = ref(startOfWeek(new Date()))
selectedDay.value = (() => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
})()
const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const d = new Date(rangeStart.value)
    d.setDate(d.getDate() + i)
    return d
  }),
)
const dayAppts = computed(() =>
  visible.value
    .filter((a) => a.status !== 'cancelled' && sameDay(a.startsAt, selectedDay.value))
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime()),
)

// Huecos libres del día para el barbero filtrado (solo tiene sentido con un barbero
// concreto; con "todos" no se puede saber de quién es el hueco).
const dayFreeSlots = computed(() => {
  const b = barberFilter.value ? barbers.value.find((x) => x.id === barberFilter.value) : null
  if (!b) return []
  const localTt = settings.value ? resolveDayTimetable(settings.value.timetable, selectedDay.value) : undefined
  const barberTt = resolveDayTimetable(b.timetable, selectedDay.value)
  const busy = dayAppts.value
    .filter((a) => a.status === 'booked' || a.status === 'completed')
    .map((a) => ({ start: a.startsAt, end: a.endsAt }))
  return freeWindows({ day: selectedDay.value, localTimetable: localTt, barberTimetable: barberTt, busy, minMinutes: 10 })
})
// Barberos a mostrar en el board de columnas: el filtrado (si hay) o todos.
const boardBarbers = computed(() =>
  barberFilter.value ? barbers.value.filter((b) => b.id === barberFilter.value) : barbers.value,
)
// Huecos libres por barbero para el día seleccionado (se pintan en cada columna).
const freeByBarber = computed(() => {
  const map: Record<string, { start: Date; end: Date }[]> = {}
  const localTt = settings.value ? resolveDayTimetable(settings.value.timetable, selectedDay.value) : undefined
  for (const b of boardBarbers.value) {
    const barberTt = resolveDayTimetable(b.timetable, selectedDay.value)
    const busy = dayAppts.value
      .filter((a) => a.barberId === b.id && (a.status === 'booked' || a.status === 'completed'))
      .map((a) => ({ start: a.startsAt, end: a.endsAt }))
    map[b.id] = freeWindows({ day: selectedDay.value, localTimetable: localTt, barberTimetable: barberTt, busy, minMinutes: 10 })
  }
  return map
})
// Vista móvil de la agenda: "columns" (columnas por barbero) o "list" (timeline).
const mobileView = ref<'columns' | 'list'>('columns')

type PillKind = 'confirmed' | 'done' | 'pending' | 'cancelled' | 'neutral'
function mobileStatusKind(s: string): PillKind {
  return s === 'completed' ? 'done' : s === 'no_show' ? 'cancelled' : 'confirmed'
}
function mobileStatusLabel(s: string) {
  return s === 'completed' ? 'Hecha' : s === 'no_show' ? 'No vino' : 'Confirmada'
}

const bookingOpen = ref(false)
const fixedOpen = ref(false)

// — Vista de escritorio: "calendar" (Schedule-X) o "team" (columnas por barbero) —
const desktopView = ref<'calendar' | 'team'>('calendar')
// Asegura que el rango consultado a Firestore cubre el día mostrado en la vista equipo.
function ensureRange(d: Date) {
  if (d.getTime() < rangeStart.value.getTime() || d.getTime() >= rangeEnd.value.getTime()) {
    const s = startOfWeek(d)
    rangeStart.value = s
    rangeEnd.value = new Date(s.getTime() + 7 * 86_400_000)
  }
}
function shiftDay(n: number) {
  const d = new Date(selectedDay.value)
  d.setDate(d.getDate() + n)
  selectedDay.value = d
  ensureRange(d)
}
function goToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  selectedDay.value = d
  ensureRange(d)
}
</script>

<template>
  <div>
    <AdminHeader title="Agenda" sub="Calendario del estudio">
      <template #actions>
        <UButton color="neutral" variant="soft" icon="i-lucide-repeat" @click="fixedOpen = true"><span class="hidden sm:inline">Citas fijas</span></UButton>
        <UButton color="primary" icon="i-lucide-plus" @click="bookingOpen = true"><span class="hidden sm:inline">Nueva cita</span></UButton>
      </template>
    </AdminHeader>

    <div class="space-y-4 px-5 py-5 pb-24 lg:px-7 lg:pb-5">
      <!-- tira de días (solo móvil) -->
      <div class="grid grid-cols-7 gap-1.5 lg:hidden">
        <button
          v-for="d in weekDays"
          :key="d.toISOString()"
          type="button"
          class="flex flex-col items-center gap-1 rounded-xl border py-2"
          :class="sameDay(d, selectedDay) ? 'border-primary bg-primary text-inverted' : 'border-default bg-muted'"
          @click="selectedDay = d"
        >
          <span class="font-mono text-[0.6rem] uppercase">{{ fmtDate(d, 'EEEEE') }}</span>
          <span class="font-display text-lg leading-none">{{ fmtDate(d, 'd') }}</span>
        </button>
      </div>

      <!-- filtro por barbero -->
      <div class="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          class="shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium"
          :class="!barberFilter ? 'border-primary/40 bg-primary/10 text-primary' : 'border-default bg-muted text-muted'"
          @click="barberFilter = null"
        >
          Todos
        </button>
        <button
          v-for="b in barbers"
          :key="b.id"
          type="button"
          class="flex shrink-0 items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium"
          :class="barberFilter === b.id ? 'border-primary/40 bg-primary/10' : 'border-default bg-muted text-muted'"
          @click="barberFilter = b.id"
        >
          <span class="size-2.5 rounded-full" :style="{ background: b.color }" />{{ b.name.split(' ')[0] }}
        </button>
      </div>

      <!-- selector de vista de escritorio: Calendario / Equipo (columnas) -->
      <div class="hidden items-center justify-between gap-3 lg:flex">
        <div class="border-default bg-muted inline-flex rounded-lg border p-0.5">
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition"
            :class="desktopView === 'calendar' ? 'bg-primary text-inverted' : 'text-muted hover:text-default'"
            @click="desktopView = 'calendar'"
          >
            <UIcon name="i-lucide-calendar-days" class="mr-1 inline size-4 align-[-2px]" />Calendario
          </button>
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm font-medium transition"
            :class="desktopView === 'team' ? 'bg-primary text-inverted' : 'text-muted hover:text-default'"
            @click="desktopView = 'team'"
          >
            <UIcon name="i-lucide-columns-3" class="mr-1 inline size-4 align-[-2px]" />Equipo
          </button>
        </div>
        <!-- navegación de día (solo vista equipo) -->
        <div v-if="desktopView === 'team'" class="flex items-center gap-1.5">
          <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-chevron-left" aria-label="Día anterior" @click="shiftDay(-1)" />
          <button type="button" class="border-default bg-muted hover:text-default text-toned min-w-44 rounded-lg border px-3 py-1.5 text-center text-sm font-medium capitalize" @click="goToday">
            {{ fmtDate(selectedDay, "EEEE d 'de' MMMM") }}
          </button>
          <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-chevron-right" aria-label="Día siguiente" @click="shiftDay(1)" />
        </div>
      </div>

      <!-- vista equipo: columnas por barbero -->
      <div v-show="desktopView === 'team'" class="border-default bg-muted relative hidden max-h-[760px] overflow-auto rounded-2xl border lg:block">
        <AdminDayBoard :day="selectedDay" :barbers="boardBarbers" :appointments="enriched" :free-by-barber="freeByBarber" @select="selected = $event" />
        <Transition enter-active-class="transition-opacity duration-200" leave-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-to-class="opacity-0">
          <div v-if="loading" class="bg-default/55 absolute inset-0 z-20 flex items-center justify-center backdrop-blur-[1px]">
            <div class="border-default bg-elevated/90 flex items-center gap-2.5 rounded-full border px-4 py-2 shadow-lg">
              <UIcon name="i-lucide-loader-circle" class="text-primary size-4 animate-spin" />
              <span class="text-toned text-sm font-medium">Cargando citas…</span>
            </div>
          </div>
        </Transition>
      </div>

      <!-- calendario (escritorio) -->
      <div v-show="desktopView === 'calendar'" class="border-default bg-muted relative hidden overflow-hidden rounded-2xl border lg:block">
        <ClientOnly>
          <ScheduleXCalendar v-if="calendarApp" :calendar-app="calendarApp" />
          <div v-else class="flex h-[720px] flex-col items-center justify-center gap-3">
            <UIcon name="i-lucide-loader-circle" class="text-primary size-6 animate-spin" />
            <span class="text-dimmed text-sm">Cargando agenda…</span>
          </div>
          <template #fallback>
            <div class="flex h-[720px] flex-col items-center justify-center gap-3">
              <UIcon name="i-lucide-loader-circle" class="text-primary size-6 animate-spin" />
              <span class="text-dimmed text-sm">Cargando agenda…</span>
            </div>
          </template>
        </ClientOnly>
        <!-- velo de carga mientras llegan/cambian las citas (evita la agenda en blanco) -->
        <Transition enter-active-class="transition-opacity duration-200" leave-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-to-class="opacity-0">
          <div v-if="loading && calendarApp" class="bg-default/55 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]">
            <div class="border-default bg-elevated/90 flex items-center gap-2.5 rounded-full border px-4 py-2 shadow-lg">
              <UIcon name="i-lucide-loader-circle" class="text-primary size-4 animate-spin" />
              <span class="text-toned text-sm font-medium">Cargando citas…</span>
            </div>
          </div>
        </Transition>
      </div>

      <!-- móvil: selector Columnas / Lista -->
      <div class="flex items-center gap-2 lg:hidden">
        <div class="border-default bg-muted inline-flex rounded-lg border p-0.5">
          <button type="button" class="rounded-md px-3 py-1.5 text-sm font-medium transition" :class="mobileView === 'columns' ? 'bg-primary text-inverted' : 'text-muted'" @click="mobileView = 'columns'">
            <UIcon name="i-lucide-columns-3" class="mr-1 inline size-4 align-[-2px]" />Columnas
          </button>
          <button type="button" class="rounded-md px-3 py-1.5 text-sm font-medium transition" :class="mobileView === 'list' ? 'bg-primary text-inverted' : 'text-muted'" @click="mobileView = 'list'">
            <UIcon name="i-lucide-list" class="mr-1 inline size-4 align-[-2px]" />Lista
          </button>
        </div>
      </div>

      <!-- móvil: columnas por barbero (visión general del equipo + huecos libres) -->
      <div v-show="mobileView === 'columns'" class="border-default bg-muted relative max-h-[68vh] overflow-auto rounded-2xl border lg:hidden">
        <AdminDayBoard v-if="boardBarbers.length" :day="selectedDay" :barbers="boardBarbers" :appointments="enriched" :free-by-barber="freeByBarber" @select="selected = $event" />
        <div v-else class="p-8"><UiEmptyState icon="i-lucide-users" title="Sin barberos" description="Añade barberos en Equipo." /></div>
        <Transition enter-active-class="transition-opacity duration-200" leave-active-class="transition-opacity duration-200" enter-from-class="opacity-0" leave-to-class="opacity-0">
          <div v-if="loading" class="bg-default/55 absolute inset-0 z-40 flex items-center justify-center backdrop-blur-[1px]">
            <div class="border-default bg-elevated/90 flex items-center gap-2.5 rounded-full border px-4 py-2 shadow-lg">
              <UIcon name="i-lucide-loader-circle" class="text-primary size-4 animate-spin" />
              <span class="text-toned text-sm font-medium">Cargando…</span>
            </div>
          </div>
        </Transition>
      </div>

      <!-- móvil: timeline (lista) -->
      <div v-show="mobileView === 'list'" class="lg:hidden">
        <div v-if="loading" class="space-y-3 pt-1">
          <div v-for="i in 5" :key="i" class="flex gap-3">
            <div class="bg-muted mt-3 h-3 w-9 shrink-0 animate-pulse rounded" />
            <div class="bg-muted h-[68px] flex-1 animate-pulse rounded-2xl" />
          </div>
        </div>
        <div v-else-if="dayAppts.length" class="pt-1">
          <div v-for="a in dayAppts" :key="a.id" class="flex gap-3">
            <div class="w-11 shrink-0 pt-3 text-right">
              <span class="text-toned font-mono text-xs font-semibold">{{ fmtDate(a.startsAt, 'HH:mm') }}</span>
            </div>
            <div class="relative">
              <span class="ring-default absolute top-4 -left-px size-2.5 rounded-full ring-2" :style="{ background: a.barberColor || 'var(--jdvm-accent)' }" />
              <span class="bg-border absolute top-6 left-[3px] bottom-0 w-px" />
            </div>
            <button
              type="button"
              class="border-default bg-muted mb-3 flex-1 rounded-2xl border border-l-[3px] p-3.5 text-left"
              :style="{ borderLeftColor: a.barberColor || 'var(--jdvm-accent)' }"
              @click="selected = a"
            >
              <div class="flex items-center gap-3">
                <div class="bg-elevated border-default flex size-8 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold">{{ initials(a.clientName) }}</div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2"><span class="truncate text-sm font-semibold">{{ a.clientName }}</span><ClientInfoButton :name="a.clientName" :phone="a.clientPhone" :email="a.clientEmail" /></div>
                  <div class="text-dimmed truncate text-xs">{{ a.serviceName }} · {{ a.barberName }}</div>
                </div>
                <AdminPill :kind="mobileStatusKind(a.status)">{{ mobileStatusLabel(a.status) }}</AdminPill>
              </div>
            </button>
          </div>
        </div>
        <UiEmptyState v-else icon="i-lucide-calendar-x" title="Sin citas" :description="`No hay citas el ${fmtDate(selectedDay, 'd MMM')}.`" />

        <!-- huecos libres del barbero filtrado -->
        <div v-if="dayFreeSlots.length" class="mt-4">
          <p class="text-dimmed mb-2.5 flex items-center gap-1.5 font-mono text-[0.6rem] tracking-widest uppercase"><span class="bg-success size-1.5 rounded-full" />Huecos libres</p>
          <div class="flex flex-wrap gap-2">
            <span v-for="(f, i) in dayFreeSlots" :key="i" class="border-success/30 bg-success/10 text-success rounded-lg border px-2.5 py-1.5 font-mono text-xs font-semibold">{{ fmtDate(f.start, 'HH:mm') }}–{{ fmtDate(f.end, 'HH:mm') }}</span>
          </div>
        </div>
        <p v-else-if="!barberFilter" class="text-dimmed mt-4 text-center text-xs">Filtra por un barbero para ver sus huecos libres.</p>
      </div>
    </div>

    <AdminFab label="Nueva cita" @click="bookingOpen = true" />

    <!-- detalle de cita (drawer) -->
    <Transition
      enter-active-class="transition-opacity"
      leave-active-class="transition-opacity"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div v-if="selected" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center" @click="selected = null">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div class="border-default bg-default relative w-full max-w-md overflow-hidden rounded-t-3xl border sm:rounded-3xl" @click.stop>
          <div class="px-5 py-5">
            <div class="flex items-start justify-between">
              <div>
                <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase capitalize">{{ fmtDate(selected.startsAt, "EEEE d 'de' MMMM") }}</p>
                <h2 class="font-display mt-1 text-2xl">{{ fmtDate(selected.startsAt, 'HH:mm') }}–{{ fmtDate(selected.endsAt, 'HH:mm') }}</h2>
              </div>
              <span class="font-display text-2xl">{{ formatPrice(selected.price) }}</span>
            </div>

            <div class="border-default bg-muted mt-4 space-y-2.5 rounded-2xl border p-4">
              <div class="flex items-center gap-3"><UIcon name="i-lucide-user" class="text-primary size-4" /><span class="text-sm font-semibold">{{ selected.clientName }}</span><span v-if="selected.clientPhone" class="text-dimmed ml-auto font-mono text-xs">{{ selected.clientPhone }}</span></div>
              <div class="flex items-center gap-3"><UIcon name="i-lucide-scissors" class="text-primary size-4" /><span class="text-sm">{{ selected.serviceName }}</span></div>
              <div class="flex items-center gap-3"><span class="size-3 rounded-full" :style="{ background: selected.barberColor }" /><span class="text-sm">{{ selected.barberName }}</span></div>
            </div>

            <div class="mt-4 grid grid-cols-2 gap-2.5">
              <UButton v-if="selected.status === 'booked'" color="success" variant="soft" block icon="i-lucide-check" @click="markCompleted(selected.id)">Completar</UButton>
              <UButton v-if="selected.status === 'booked'" color="neutral" variant="soft" block icon="i-lucide-user-x" @click="markNoShow(selected.id)">No vino</UButton>
              <UButton v-if="selected.status === 'booked'" color="warning" variant="soft" block icon="i-lucide-calendar-x" @click="cancelAppt">Cancelar</UButton>
              <UButton color="error" variant="soft" block icon="i-lucide-trash-2" @click="deleteAppt">Eliminar</UButton>
            </div>
            <p v-if="selected.status === 'booked' && !isCancellable(selected.startsAt)" class="text-dimmed mt-3 text-center text-xs">
              Fuera de la ventana de 4 h del cliente · como admin puedes igualmente.
            </p>

            <!-- ofrecer veto tras marcar "no vino" -->
            <div v-if="banPrompt" class="border-warning/40 bg-warning/10 mt-4 rounded-2xl border p-4">
              <p class="text-sm font-medium">El cliente no se presentó. ¿Vetarlo para que no coja más citas hasta que pague la cita perdida?</p>
              <div class="mt-3 flex gap-2.5">
                <UButton color="error" class="flex-1 justify-center" icon="i-lucide-ban" :loading="banBusy" @click="banFromPrompt">Vetar cliente</UButton>
                <UButton color="neutral" variant="soft" class="flex-1 justify-center" @click="banPrompt = false">Ahora no</UButton>
              </div>
            </div>
            <p v-else-if="selectedBanned" class="text-error mt-3 flex items-center justify-center gap-1.5 text-xs"><UIcon name="i-lucide-ban" class="size-3.5" />Cliente vetado.</p>
          </div>
        </div>
      </div>
    </Transition>

    <AdminBookingModal v-model:open="bookingOpen" :preset-date="rangeStart" />
    <AdminFixedModal v-model:open="fixedOpen" />
  </div>
</template>

<style>
/* Cablea el tema oscuro de Schedule-X a la paleta forest. */
.sx__calendar,
.sx-vue-calendar-wrapper {
  /* Schedule-X pone la cabecera semanal en z-index 100 y sus popups en 102, por
     encima de los modales de la app (z-50), así que se pintaban sobre el modal
     "Nueva cita". Los bajamos por debajo de los overlays de la app. */
  --sx-z-index-week-header: 5;
  --sx-z-index-event-modal: 6;
  --sx-calendar-header-popup-z-index: 6;
  --sx-color-primary: var(--ui-primary);
  --sx-color-on-primary: #0b0f0c;
  --sx-color-primary-container: color-mix(in oklab, var(--ui-primary) 25%, transparent);
  --sx-color-on-primary-container: var(--ui-text);
  --sx-color-surface: var(--ui-bg);
  --sx-color-surface-dim: var(--ui-bg-muted);
  --sx-color-surface-container: var(--ui-bg-elevated);
  --sx-color-surface-container-low: var(--ui-bg-muted);
  --sx-color-surface-container-high: var(--ui-bg-elevated);
  --sx-color-on-surface: var(--ui-text);
  --sx-color-outline: var(--ui-border);
  --sx-color-outline-variant: var(--ui-border);
  --sx-internal-color-text: var(--ui-text);
  font-family: inherit;
}
.sx__calendar {
  border: none !important;
}
</style>
