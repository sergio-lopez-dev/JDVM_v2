<script setup lang="ts">
import { WEEKDAYS, type Weekday, type WeekTimetable, type TimeRange } from '~~/schemas'

const model = defineModel<WeekTimetable>({ required: true })

const DAY_LABELS: Record<Weekday, string> = {
  mon: 'Lunes',
  tue: 'Martes',
  wed: 'Miércoles',
  thu: 'Jueves',
  fri: 'Viernes',
  sat: 'Sábado',
  sun: 'Domingo',
}

type Period = 'morning' | 'afternoon'

function isOpen(day: Weekday, period: Period) {
  return !!model.value[day]?.[period]
}

// Reescribe el horario de un día (omitiendo periodos/días vacíos para no
// guardar `undefined` en Firestore).
function writeDay(day: Weekday, dayTt: { morning?: TimeRange; afternoon?: TimeRange }) {
  const next: WeekTimetable = {}
  for (const [k, v] of Object.entries(model.value)) {
    if (k !== day && v) next[k as Weekday] = v
  }
  const clean: { morning?: TimeRange; afternoon?: TimeRange } = {}
  if (dayTt.morning) clean.morning = dayTt.morning
  if (dayTt.afternoon) clean.afternoon = dayTt.afternoon
  if (clean.morning || clean.afternoon) next[day] = clean
  model.value = next
}

function toggle(day: Weekday, period: Period) {
  const dayTt = { ...(model.value[day] ?? {}) }
  if (dayTt[period]) dayTt[period] = undefined
  else dayTt[period] = period === 'morning' ? { start: '10:00', end: '14:00' } : { start: '16:00', end: '20:00' }
  writeDay(day, dayTt)
}
function setTime(day: Weekday, period: Period, edge: 'start' | 'end', value: string) {
  const dayTt = { ...(model.value[day] ?? {}) }
  const range = { ...(dayTt[period] ?? { start: '10:00', end: '14:00' }) }
  range[edge] = value
  dayTt[period] = range
  writeDay(day, dayTt)
}
</script>

<template>
  <div class="space-y-2">
    <div
      v-for="d in WEEKDAYS"
      :key="d"
      class="border-default bg-muted rounded-xl border p-3"
    >
      <p class="mb-2 text-sm font-semibold">{{ DAY_LABELS[d] }}</p>
      <div class="grid gap-2 sm:grid-cols-2">
        <div v-for="p in (['morning', 'afternoon'] as const)" :key="p" class="flex items-center gap-2">
          <button
            type="button"
            class="flex size-7 shrink-0 items-center justify-center rounded-lg border"
            :class="isOpen(d, p) ? 'border-primary bg-primary text-inverted' : 'border-default bg-elevated text-dimmed'"
            :aria-label="p === 'morning' ? 'Mañana' : 'Tarde'"
            @click="toggle(d, p)"
          >
            <UIcon :name="p === 'morning' ? 'i-lucide-sunrise' : 'i-lucide-sunset'" class="size-4" />
          </button>
          <template v-if="isOpen(d, p)">
            <input
              type="time"
              :value="model[d]?.[p]?.start"
              class="border-default bg-elevated text-default w-full rounded-lg border px-2 py-1 text-xs [color-scheme:dark]"
              @input="setTime(d, p, 'start', ($event.target as HTMLInputElement).value)"
            />
            <span class="text-dimmed text-xs">–</span>
            <input
              type="time"
              :value="model[d]?.[p]?.end"
              class="border-default bg-elevated text-default w-full rounded-lg border px-2 py-1 text-xs [color-scheme:dark]"
              @input="setTime(d, p, 'end', ($event.target as HTMLInputElement).value)"
            />
          </template>
          <span v-else class="text-dimmed text-xs">{{ p === 'morning' ? 'Mañana' : 'Tarde' }} cerrado</span>
        </div>
      </div>
    </div>
  </div>
</template>
