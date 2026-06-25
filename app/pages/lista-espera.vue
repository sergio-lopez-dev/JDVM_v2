<script setup lang="ts">
import { formatDuration, formatPrice, fmtDate } from '~~/lib/format'
import { toDate } from '~~/lib/datetime'
import { WEEKDAYS } from '~~/schemas'
import type { Weekday } from '~~/schemas'

definePageMeta({ layout: 'inner', middleware: 'auth' })
useHead({ title: 'Lista de espera' })

const route = useRoute()
const user = useCurrentUser()
const toast = useToast()
const { publicServices } = useServices()
const { active: barbers } = useBarbers()
const { mine, alreadyOnList, join, leave } = useWaitlist()

const serviceId = ref<string>((route.query.service as string) || '')
watchEffect(() => {
  if (!serviceId.value && publicServices.value.length) serviceId.value = publicServices.value[0]!.id
})
const service = computed(() => publicServices.value.find((s) => s.id === serviceId.value) ?? null)

// Barberos que ofrecen el servicio elegido (si el servicio no acota, todos los activos).
const eligibleBarbers = computed(() =>
  service.value
    ? barbers.value.filter((b) => b.servicesOffered.includes(service.value!.id))
    : barbers.value,
)
// '' = cualquier barbero. Si el barbero seleccionado deja de ofrecer el servicio, se resetea.
const barberId = ref<string>((route.query.barber as string) || '')
watchEffect(() => {
  if (barberId.value && !eligibleBarbers.value.some((b) => b.id === barberId.value)) {
    barberId.value = ''
  }
})
const barberItems = computed(() => [
  { label: 'Cualquier barbero', value: '' },
  ...eligibleBarbers.value.map((b) => ({ label: b.name, value: b.id })),
])

// Día concreto que quiere el cliente (opcional). Si llega ?date=yyyy-MM-dd (p. ej. al
// venir de un día completo del calendario de reserva) se preselecciona. Con un día
// concreto, la lista de espera apunta SOLO a ese día; sin él, vale cualquier día de los
// próximos 14 (con los días de la semana marcados como preferencia).
function parseDateParam(v?: string): Date | null {
  if (!v) return null
  const [y, m, d] = v.split('-').map(Number)
  if (!y || !m || !d) return null
  const nd = new Date(y, m - 1, d)
  nd.setHours(0, 0, 0, 0)
  return nd.getTime() >= new Date().setHours(0, 0, 0, 0) ? nd : null
}
const todayStr = fmtDate(new Date(), 'yyyy-MM-dd')
const wantedDate = ref<Date | null>(parseDateParam(route.query.date as string))
const wantedDateValue = computed(() =>
  wantedDate.value ? fmtDate(wantedDate.value, 'yyyy-MM-dd') : '',
)
function setWantedDate(v: string) {
  wantedDate.value = parseDateParam(v)
}

// Días de la semana (vacío = cualquiera). Lun→Dom para mostrar.
const DAY_LABELS: Record<Weekday, string> = {
  mon: 'Lun',
  tue: 'Mar',
  wed: 'Mié',
  thu: 'Jue',
  fri: 'Vie',
  sat: 'Sáb',
  sun: 'Dom',
}
const days = ref<Weekday[]>([])
function toggleDay(d: Weekday) {
  days.value = days.value.includes(d) ? days.value.filter((x) => x !== d) : [...days.value, d]
}

// Franja preferida: mañana / tarde / ambas (decide el rango horario que se guarda).
type SlotPref = 'morning' | 'afternoon' | 'both'
const TIME_RANGES: Record<SlotPref, { start: string; end: string; label: string }> = {
  morning: { start: '10:00', end: '14:00', label: 'Mañanas' },
  afternoon: { start: '16:00', end: '22:00', label: 'Tardes' },
  both: { start: '10:00', end: '22:00', label: 'Mañana y tarde' },
}
const SLOT_OPTIONS: { value: SlotPref; label: string }[] = [
  { value: 'morning', label: 'Mañana' },
  { value: 'afternoon', label: 'Tarde' },
  { value: 'both', label: 'Ambas' },
]
const slotPref = ref<SlotPref>('afternoon')
const busy = ref(false)

// Resumen legible de la entrada activa (cuando ya está en la lista).
const myEntry = computed(() => mine.value[0] ?? null)
const myEntryBarber = computed(() => {
  const id = myEntry.value?.preferredBarberId
  if (!id) return 'Cualquiera'
  return barbers.value.find((b) => b.id === id)?.name ?? 'Cualquiera'
})
const myEntryDays = computed(() => {
  const ds = myEntry.value?.preferredWeekdays ?? []
  if (!ds.length) return 'Cualquiera'
  return WEEKDAYS.filter((d) => ds.includes(d))
    .map((d) => DAY_LABELS[d])
    .join(', ')
})
const myEntryTime = computed(() => {
  const r = myEntry.value?.timeRange
  if (!r) return 'Cualquiera'
  const match = (
    Object.values(TIME_RANGES) as { start: string; end: string; label: string }[]
  ).find((t) => t.start === r.start && t.end === r.end)
  return match ? `${match.label} (${r.start}–${r.end})` : `${r.start}–${r.end}`
})
// Día concreto guardado: si el rango de fechas abarca ~1 día, lo mostramos.
const myEntryDate = computed(() => {
  const r = myEntry.value?.preferredDates
  if (!r) return null
  const start = toDate(r.start)
  const end = toDate(r.end)
  return end.getTime() - start.getTime() <= 36 * 3_600_000
    ? fmtDate(start, "EEEE d 'de' MMMM")
    : null
})

async function joinList() {
  if (!user.value || !service.value) return
  busy.value = true
  try {
    // Día concreto → rango de ese único día; si no, ventana de los próximos 14 días.
    let start: Date
    let end: Date
    if (wantedDate.value) {
      start = new Date(wantedDate.value)
      start.setHours(0, 0, 0, 0)
      end = new Date(start)
      end.setDate(end.getDate() + 1)
    } else {
      start = new Date()
      start.setHours(0, 0, 0, 0)
      end = new Date(start)
      end.setDate(end.getDate() + 14)
    }
    await join({
      clientId: user.value.uid,
      serviceId: service.value.id,
      preferredBarberId: barberId.value || null,
      timeRange: { start: TIME_RANGES[slotPref.value].start, end: TIME_RANGES[slotPref.value].end },
      preferredDates: { start, end },
      // Con día concreto, los días de la semana no aplican (el rango ya es ese día).
      preferredWeekdays: wantedDate.value ? [] : WEEKDAYS.filter((d) => days.value.includes(d)),
      notified: false,
    })
    toast.add({
      title: 'Estás en la lista',
      description: 'Te avisaremos cuando se libere un hueco.',
      icon: 'i-lucide-bell',
      color: 'primary',
    })
  } catch {
    toast.add({ title: 'No se pudo unir', color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    busy.value = false
  }
}

async function leaveList() {
  const entry = mine.value[0]
  if (entry) await leave(entry.id)
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <AppBar title="Lista de espera" />

    <div class="flex-1 space-y-5 px-5 py-3">
      <div class="py-3 text-center">
        <div
          class="bg-primary/15 border-primary/30 mx-auto flex size-20 items-center justify-center rounded-full border"
        >
          <UIcon name="i-lucide-bell" class="text-primary size-8" />
        </div>
        <h1 class="font-display mt-4 text-3xl leading-tight">
          {{ alreadyOnList ? 'Estás en la lista' : 'Únete a la lista' }}
        </h1>
        <p class="text-muted mx-auto mt-2 max-w-xs text-sm leading-relaxed">
          Te avisaremos en cuanto se libere un hueco que encaje con tus preferencias.
        </p>
      </div>

      <!-- posición (placeholder hasta el matching de la Cloud Function) -->
      <div
        v-if="alreadyOnList"
        class="border-default bg-muted flex overflow-hidden rounded-2xl border"
      >
        <div
          v-for="(s, i) in [
            ['nº 3', 'En cola'],
            ['~2 días', 'Espera media'],
            ['Jue', 'Día objetivo'],
          ]"
          :key="s[1]"
          class="flex-1 px-2 py-4 text-center"
          :class="i ? 'border-default border-l' : ''"
        >
          <p class="text-primary font-display text-xl">{{ s[0] }}</p>
          <p class="text-dimmed mt-1 text-[0.65rem]">{{ s[1] }}</p>
        </div>
      </div>

      <!-- servicio objetivo -->
      <div class="border-default bg-muted rounded-2xl border p-4">
        <p class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">Buscas</p>
        <div class="flex items-center gap-3">
          <div class="bg-primary/15 flex size-9 items-center justify-center rounded-lg">
            <UIcon name="i-lucide-scissors" class="text-primary size-4" />
          </div>
          <div class="flex-1">
            <USelect
              v-if="!alreadyOnList"
              v-model="serviceId"
              :items="publicServices.map((s) => ({ label: s.name, value: s.id }))"
              class="w-full"
            />
            <template v-else>
              <p class="text-sm font-semibold">{{ service?.name }}</p>
            </template>
            <p v-if="service" class="text-dimmed mt-0.5 font-mono text-[0.65rem]">
              {{ formatDuration(service.durationMinutes) }} · {{ formatPrice(service.basePrice) }}
            </p>
          </div>
        </div>
      </div>

      <!-- barbero preferido -->
      <div v-if="!alreadyOnList" class="border-default bg-muted rounded-2xl border p-4">
        <p class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">Con quién</p>
        <div class="flex items-center gap-3">
          <div class="bg-primary/15 flex size-9 items-center justify-center rounded-lg">
            <UIcon name="i-lucide-user" class="text-primary size-4" />
          </div>
          <USelect v-model="barberId" :items="barberItems" class="w-full" />
        </div>
      </div>

      <!-- día concreto que quiere (opcional; preseleccionado si vino del calendario) -->
      <div v-if="!alreadyOnList">
        <p class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">
          Qué día quieres
        </p>
        <div class="border-default bg-muted flex items-center gap-3 rounded-2xl border p-4">
          <div class="bg-primary/15 flex size-9 shrink-0 items-center justify-center rounded-lg">
            <UIcon name="i-lucide-calendar" class="text-primary size-4" />
          </div>
          <input
            type="date"
            :value="wantedDateValue"
            :min="todayStr"
            class="border-default bg-elevated text-default min-w-0 flex-1 rounded-xl border px-3 py-2.5 text-sm [color-scheme:dark]"
            @input="setWantedDate(($event.target as HTMLInputElement).value)"
          />
          <UButton
            v-if="wantedDate"
            color="neutral"
            variant="soft"
            icon="i-lucide-x"
            aria-label="Quitar día"
            @click="wantedDate = null"
          />
        </div>
        <p class="text-dimmed mt-2 text-xs">
          {{
            wantedDate
              ? `Te avisaremos si se libera un hueco el ${fmtDate(wantedDate, "EEEE d 'de' MMMM")}.`
              : 'Sin elegir día: vale cualquier día de los próximos 14.'
          }}
        </p>
      </div>

      <!-- días que le vienen bien (solo si NO ha fijado un día concreto) -->
      <div v-if="!alreadyOnList && !wantedDate">
        <p class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">
          Qué días te van bien
        </p>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="d in WEEKDAYS"
            :key="d"
            type="button"
            class="border-default rounded-xl border px-3.5 py-2 text-sm font-semibold transition"
            :class="
              days.includes(d) ? 'bg-primary text-inverted border-primary' : 'bg-muted text-toned'
            "
            @click="toggleDay(d)"
          >
            {{ DAY_LABELS[d] }}
          </button>
        </div>
        <p class="text-dimmed mt-2 text-xs">Sin marcar ninguno = cualquier día.</p>
      </div>

      <!-- franja horaria preferida -->
      <div v-if="!alreadyOnList">
        <p class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">
          Qué franja prefieres
        </p>
        <div class="border-default bg-muted grid grid-cols-3 gap-1 rounded-xl border p-1">
          <button
            v-for="o in SLOT_OPTIONS"
            :key="o.value"
            type="button"
            class="rounded-lg py-2.5 text-sm font-semibold transition"
            :class="
              slotPref === o.value
                ? 'bg-primary text-inverted shadow-sm'
                : 'text-muted hover:text-default'
            "
            @click="slotPref = o.value"
          >
            {{ o.label }}
          </button>
        </div>
        <p class="text-dimmed mt-2 text-xs">
          {{ TIME_RANGES[slotPref].label }}: {{ TIME_RANGES[slotPref].start }}–{{
            TIME_RANGES[slotPref].end
          }}
        </p>
      </div>

      <!-- resumen cuando ya está en la lista -->
      <div v-else class="border-default bg-muted rounded-2xl border p-4">
        <p class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">
          Tus preferencias
        </p>
        <dl class="space-y-2 text-sm">
          <div v-if="myEntryDate" class="flex justify-between gap-3">
            <dt class="text-toned">Día</dt>
            <dd class="font-medium capitalize">{{ myEntryDate }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-toned">Barbero</dt>
            <dd class="font-medium">{{ myEntryBarber }}</dd>
          </div>
          <div v-if="!myEntryDate" class="flex justify-between gap-3">
            <dt class="text-toned">Días</dt>
            <dd class="font-medium">{{ myEntryDays }}</dd>
          </div>
          <div class="flex justify-between gap-3">
            <dt class="text-toned">Horario</dt>
            <dd class="font-medium">{{ myEntryTime }}</dd>
          </div>
        </dl>
      </div>
    </div>

    <div class="border-default bg-default sticky bottom-0 border-t px-5 py-3">
      <UButton
        v-if="alreadyOnList"
        color="error"
        variant="outline"
        size="lg"
        block
        @click="leaveList"
        >Salir de la lista</UButton
      >
      <UButton
        v-else
        color="primary"
        size="lg"
        block
        :loading="busy"
        icon="i-lucide-bell"
        @click="joinList"
        >Unirme a la lista</UButton
      >
    </div>
  </div>
</template>
