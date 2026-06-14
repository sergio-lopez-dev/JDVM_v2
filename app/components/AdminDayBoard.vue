<script setup lang="ts">
// Vista "Día · equipo": un eje horario a la izquierda y una columna por barbero con
// sus citas del día posicionadas por hora + sus huecos libres. Da visión general de
// todo el equipo a la vez (Schedule-X v4 no tiene vista de recursos/columnas). Click
// en una cita → emite `select` para abrir el drawer de detalle.
import { fmtDate, initials } from '~~/lib/format'
import { sameDay } from '~~/lib/datetime'
import type { AdminAppointment } from '~/composables/useAdminAppointments'
import type { Barber } from '~~/schemas'

type FreeWindow = { start: Date; end: Date }

const props = defineProps<{
  day: Date
  barbers: Barber[]
  appointments: AdminAppointment[]
  freeByBarber?: Record<string, FreeWindow[]>
}>()
const emit = defineEmits<{
  select: [AdminAppointment]
  // Click en un hueco libre → pedir crear cita para ese barbero a esa hora.
  pick: [{ barberId: string; start: Date }]
}>()

const PX_PER_MIN = 1.2 // alto de una hora = 72px

const dayAppts = computed(() =>
  props.appointments.filter((a) => a.status !== 'cancelled' && sameDay(a.startsAt, props.day)),
)

// Franja horaria a pintar: 9–21 por defecto, ampliada si hay citas/huecos fuera.
const bounds = computed(() => {
  let start = 9
  let end = 21
  for (const a of dayAppts.value) {
    start = Math.min(start, a.startsAt.getHours())
    end = Math.max(end, a.endsAt.getHours() + (a.endsAt.getMinutes() > 0 ? 1 : 0))
  }
  for (const list of Object.values(props.freeByBarber || {})) {
    for (const f of list) {
      start = Math.min(start, f.start.getHours())
      end = Math.max(end, f.end.getHours() + (f.end.getMinutes() > 0 ? 1 : 0))
    }
  }
  return { start: Math.max(0, start), end: Math.min(24, Math.max(end, start + 1)) }
})

const hours = computed(() =>
  Array.from({ length: bounds.value.end - bounds.value.start }, (_, i) => bounds.value.start + i),
)
const bodyHeight = computed(() => (bounds.value.end - bounds.value.start) * 60 * PX_PER_MIN)

function apptsOf(barberId: string) {
  return dayAppts.value
    .filter((a) => a.barberId === barberId)
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
}
function freeOf(barberId: string) {
  return props.freeByBarber?.[barberId] ?? []
}

// Posición/alto absoluto (en px) de un intervalo [start,end] dentro de la columna.
function bandStyle(start: Date, end: Date, gap = 2) {
  const startMin = start.getHours() * 60 + start.getMinutes() - bounds.value.start * 60
  const durMin = Math.max(15, (end.getTime() - start.getTime()) / 60_000)
  return { top: `${startMin * PX_PER_MIN}px`, height: `${durMin * PX_PER_MIN - gap}px` }
}
function styleOf(a: AdminAppointment) {
  // El borde izquierdo usa el color de la cita (servicio / serie fija) para
  // distinguir tipos de servicio dentro de la columna del barbero.
  return { ...bandStyle(a.startsAt, a.endsAt), borderLeftColor: a.eventColor || 'var(--jdvm-accent)' }
}

// Indicador de "ahora" (solo si el día mostrado es hoy).
const now = ref(new Date())
let timer: ReturnType<typeof setInterval> | undefined
onMounted(() => {
  timer = setInterval(() => (now.value = new Date()), 60_000)
})
onUnmounted(() => timer && clearInterval(timer))
const nowTop = computed(() => {
  if (!sameDay(now.value, props.day)) return null
  const min = now.value.getHours() * 60 + now.value.getMinutes() - bounds.value.start * 60
  if (min < 0 || min > (bounds.value.end - bounds.value.start) * 60) return null
  return min * PX_PER_MIN
})

const gridCols = computed(() => `48px repeat(${props.barbers.length}, minmax(116px, 1fr))`)
</script>

<template>
  <div class="overflow-x-auto">
    <div :style="{ minWidth: `${48 + barbers.length * 116}px` }">
      <!-- cabecera: barberos -->
      <div class="border-default bg-elevated sticky top-0 z-30 grid border-b" :style="{ gridTemplateColumns: gridCols }">
        <div class="px-1 py-2" />
        <div v-for="b in barbers" :key="b.id" class="border-default flex items-center gap-2 border-l px-2.5 py-2">
          <UiAvatar :name="b.name" :src="b.photoUrl || null" :size="26" :ring="b.color" />
          <span class="truncate text-sm font-semibold">{{ b.name.split(' ')[0] }}</span>
        </div>
      </div>

      <!-- cuerpo: eje + columnas -->
      <div class="relative grid" :style="{ gridTemplateColumns: gridCols, height: `${bodyHeight}px` }">
        <!-- eje horario -->
        <div class="relative">
          <div
            v-for="(h, i) in hours"
            :key="h"
            class="text-dimmed absolute right-1.5 -translate-y-1/2 font-mono text-[0.6rem]"
            :style="{ top: `${i * 60 * PX_PER_MIN}px` }"
          >
            {{ String(h).padStart(2, '0') }}:00
          </div>
        </div>

        <!-- una columna por barbero -->
        <div v-for="b in barbers" :key="b.id" class="border-default relative border-l">
          <!-- líneas de hora -->
          <div
            v-for="(h, i) in hours"
            :key="h"
            class="border-default/60 absolute inset-x-0 border-t"
            :style="{ top: `${i * 60 * PX_PER_MIN}px` }"
          />
          <!-- huecos libres (click → crear cita para ese barbero a esa hora) -->
          <button
            v-for="(f, i) in freeOf(b.id)"
            :key="`free-${i}`"
            type="button"
            class="group border-success/30 bg-success/10 hover:bg-success/20 hover:border-success/50 absolute inset-x-1 overflow-hidden rounded-md border border-dashed text-left transition"
            :style="bandStyle(f.start, f.end)"
            :title="`Crear cita · ${fmtDate(f.start, 'HH:mm')}`"
            @click="emit('pick', { barberId: b.id, start: f.start })"
          >
            <span class="text-success/90 flex items-center gap-1 px-1.5 py-0.5 font-mono text-[0.55rem] font-semibold">
              <UIcon name="i-lucide-plus" class="size-2.5 opacity-0 transition group-hover:opacity-100" />libre · {{ fmtDate(f.start, 'HH:mm') }}–{{ fmtDate(f.end, 'HH:mm') }}
            </span>
          </button>
          <!-- citas -->
          <button
            v-for="a in apptsOf(b.id)"
            :key="a.id"
            type="button"
            class="bg-muted hover:bg-elevated absolute inset-x-1 overflow-hidden rounded-md border border-l-[3px] px-2 py-1 text-left transition"
            :class="a.status === 'completed' ? 'opacity-75' : a.status === 'no_show' ? 'opacity-40 line-through' : ''"
            :style="styleOf(a)"
            @click="emit('select', a)"
          >
            <span v-if="a.status === 'completed'" class="bg-success text-inverted absolute top-1 right-1 flex size-4 items-center justify-center rounded-full text-[0.6rem] font-bold">€</span>
            <div class="flex items-center gap-1.5 pr-4">
              <span class="text-toned font-mono text-[0.6rem] font-semibold">{{ fmtDate(a.startsAt, 'HH:mm') }}</span>
              <span class="truncate text-[0.7rem] font-semibold">{{ a.clientName || initials(a.clientName) }}</span>
            </div>
            <div class="text-dimmed truncate text-[0.65rem]">{{ a.serviceName }}</div>
          </button>
        </div>

        <!-- indicador de "ahora" -->
        <div v-if="nowTop !== null" class="bg-error pointer-events-none absolute right-0 z-20 h-px" :style="{ top: `${nowTop}px`, left: '48px' }">
          <span class="bg-error absolute -top-[3px] -left-1 size-2 rounded-full" />
        </div>
      </div>
    </div>
  </div>
</template>
