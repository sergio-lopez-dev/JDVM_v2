<script setup lang="ts">
// Vista "Día · equipo": un eje horario a la izquierda y una columna por barbero con
// sus citas del día posicionadas por hora. Da visión general de todo el equipo a la
// vez (Schedule-X v4 no tiene vista de recursos/columnas). Click en una cita → emite
// `select` para abrir el mismo drawer de detalle que el resto de la agenda.
import { fmtDate, initials } from '~~/lib/format'
import { sameDay } from '~~/lib/datetime'
import type { AdminAppointment } from '~/composables/useAdminAppointments'
import type { Barber } from '~~/schemas'

const props = defineProps<{
  day: Date
  barbers: Barber[]
  appointments: AdminAppointment[]
}>()
const emit = defineEmits<{ select: [AdminAppointment] }>()

const PX_PER_MIN = 1.2 // alto de una hora = 72px

const dayAppts = computed(() =>
  props.appointments.filter((a) => a.status !== 'cancelled' && sameDay(a.startsAt, props.day)),
)

// Franja horaria a pintar: 9–21 por defecto, ampliada si hay citas fuera de rango.
const bounds = computed(() => {
  let start = 9
  let end = 21
  for (const a of dayAppts.value) {
    start = Math.min(start, a.startsAt.getHours())
    end = Math.max(end, a.endsAt.getHours() + (a.endsAt.getMinutes() > 0 ? 1 : 0))
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

// Posición/alto absoluto de una cita dentro de la columna (en px).
function styleOf(a: AdminAppointment) {
  const startMin = a.startsAt.getHours() * 60 + a.startsAt.getMinutes() - bounds.value.start * 60
  const durMin = Math.max(15, (a.endsAt.getTime() - a.startsAt.getTime()) / 60_000)
  return {
    top: `${startMin * PX_PER_MIN}px`,
    height: `${durMin * PX_PER_MIN - 2}px`,
    borderLeftColor: a.barberColor || 'var(--jdvm-accent)',
  }
}

const colWidth = 'minmax(120px, 1fr)'
const gridCols = computed(() => `56px repeat(${props.barbers.length}, ${colWidth})`)
</script>

<template>
  <div class="overflow-x-auto">
    <div :style="{ minWidth: `${56 + barbers.length * 120}px` }">
      <!-- cabecera: barberos -->
      <div class="border-default bg-elevated sticky top-0 z-10 grid border-b" :style="{ gridTemplateColumns: gridCols }">
        <div class="px-2 py-2.5" />
        <div v-for="b in barbers" :key="b.id" class="border-default flex items-center gap-2 border-l px-3 py-2.5">
          <UiAvatar :name="b.name" :src="b.photoUrl || null" :size="28" :ring="b.color" />
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
          <!-- citas -->
          <button
            v-for="a in apptsOf(b.id)"
            :key="a.id"
            type="button"
            class="bg-muted hover:bg-elevated absolute inset-x-1 overflow-hidden rounded-md border border-l-[3px] px-2 py-1 text-left transition"
            :class="a.status === 'completed' ? 'opacity-60' : a.status === 'no_show' ? 'opacity-40 line-through' : ''"
            :style="styleOf(a)"
            @click="emit('select', a)"
          >
            <div class="flex items-center gap-1.5">
              <span class="text-toned font-mono text-[0.6rem] font-semibold">{{ fmtDate(a.startsAt, 'HH:mm') }}</span>
              <span class="truncate text-[0.7rem] font-semibold">{{ a.clientName || initials(a.clientName) }}</span>
            </div>
            <div class="text-dimmed truncate text-[0.65rem]">{{ a.serviceName }}</div>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
