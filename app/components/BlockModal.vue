<script setup lang="ts">
// Bloquear un hueco de la agenda: el barbero (o el admin) se reserva un tramo en el
// que NO puede atender (médico, recado, descanso…). Crea una "cita" con type 'block'
// (sin cliente ni servicio) que ocupa el hueco → no se puede reservar encima, pero no
// cuenta como facturación.
import { fmtDate } from '~~/lib/format'
import type { Barber } from '~~/schemas'

const props = defineProps<{
  open: boolean
  presetDate?: Date
  presetTime?: string
  // Fija el barbero (app del barbero): solo puede bloquear su propia agenda.
  lockedBarberId?: string
  // Preselecciona el barbero sin fijarlo (admin): puede cambiarlo.
  presetBarberId?: string
}>()
const emit = defineEmits<{ 'update:open': [boolean]; created: [] }>()

const toast = useToast()
const { active: barbers } = useBarbers()
const { create } = useAppointments()

const barber = ref<Barber | null>(null)
const date = ref<Date>(startOfToday())
const fromTime = ref('10:00')
const toTime = ref('11:00')
const reason = ref('')
const saving = ref(false)

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
function dateAt(d: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const nd = new Date(d)
  nd.setHours(h ?? 0, m ?? 0, 0, 0)
  return nd
}

const lockedBarber = computed(() =>
  props.lockedBarberId ? (barbers.value.find((b) => b.id === props.lockedBarberId) ?? null) : null,
)

watch(
  () => props.open,
  (o) => {
    if (!o) return
    barber.value =
      lockedBarber.value ??
      (props.presetBarberId ? (barbers.value.find((b) => b.id === props.presetBarberId) ?? null) : null)
    date.value = props.presetDate ? new Date(props.presetDate) : startOfToday()
    date.value.setHours(0, 0, 0, 0)
    fromTime.value = props.presetTime ?? '10:00'
    // Fin por defecto = una hora después del inicio.
    const [h, m] = fromTime.value.split(':').map(Number)
    toTime.value = `${String((h ?? 10) + 1).padStart(2, '0')}:${String(m ?? 0).padStart(2, '0')}`
    reason.value = ''
  },
)
// Si llega el barbero fijado/preseleccionado tras abrir (carga async), lo asignamos.
watch(barbers, (list) => {
  const wanted = props.lockedBarberId ?? props.presetBarberId
  if (props.open && !barber.value && wanted) {
    barber.value = list.find((b) => b.id === wanted) ?? null
  }
})

const dateInputValue = computed(() => fmtDate(date.value, 'yyyy-MM-dd'))
function setDateFromInput(v: string) {
  const [y, m, d] = v.split('-').map(Number)
  if (y && m && d) {
    const nd = new Date(y, m - 1, d)
    nd.setHours(0, 0, 0, 0)
    date.value = nd
  }
}

const validTimes = computed(
  () => /^\d{2}:\d{2}$/.test(fromTime.value) && /^\d{2}:\d{2}$/.test(toTime.value) && toTime.value > fromTime.value,
)
const canSubmit = computed(() => !!(barber.value && validTimes.value))

async function submit() {
  if (saving.value || !canSubmit.value || !barber.value) return
  saving.value = true
  try {
    const startsAt = dateAt(date.value, fromTime.value)
    const endsAt = dateAt(date.value, toTime.value)
    await create({
      type: 'block',
      ...(reason.value.trim() ? { note: reason.value.trim() } : {}),
      clientId: '',
      barberId: barber.value.id,
      serviceId: '',
      startsAt,
      endsAt,
      status: 'booked',
      isRecurring: false,
    })
    toast.add({ title: 'Hueco bloqueado', description: 'Ese tramo queda como no disponible.', icon: 'i-lucide-lock', color: 'success' })
    emit('created')
    emit('update:open', false)
  } catch (e) {
    toast.add({ title: 'No se pudo bloquear', description: (e as Error).message, color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Transition enter-active-class="transition-opacity" leave-active-class="transition-opacity" enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center" @click="emit('update:open', false)">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div class="border-default bg-default relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border sm:rounded-3xl" @click.stop>
        <header class="border-default flex items-center justify-between border-b px-5 py-4">
          <div>
            <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">No disponible</p>
            <h2 class="font-display text-xl">Bloquear hueco</h2>
          </div>
          <button type="button" aria-label="Cerrar" class="text-muted flex size-8 items-center justify-center" @click="emit('update:open', false)"><UIcon name="i-lucide-x" class="size-5" /></button>
        </header>

        <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <!-- barbero (solo admin; el barbero queda fijado a sí mismo) -->
          <div v-if="!lockedBarberId">
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Barbero</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="b in barbers" :key="b.id" type="button" class="flex items-center gap-2 rounded-full border px-3 py-1.5" :class="barber?.id === b.id ? 'border-primary/40 bg-primary/10' : 'border-default bg-muted'" @click="barber = b">
                <span class="size-2.5 rounded-full" :style="{ background: b.color }" /><span class="text-sm font-medium">{{ b.name }}</span>
              </button>
            </div>
          </div>

          <!-- fecha -->
          <div>
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Fecha</label>
            <input type="date" :value="dateInputValue" class="border-default bg-muted text-default w-full rounded-xl border px-3 py-2.5 text-sm [color-scheme:dark]" @input="setDateFromInput(($event.target as HTMLInputElement).value)" />
          </div>

          <!-- desde / hasta -->
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Desde</label>
              <input v-model="fromTime" type="time" class="border-default bg-muted text-default w-full rounded-xl border px-3 py-2.5 text-sm [color-scheme:dark]" />
            </div>
            <div>
              <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Hasta</label>
              <input v-model="toTime" type="time" class="border-default bg-muted text-default w-full rounded-xl border px-3 py-2.5 text-sm [color-scheme:dark]" />
            </div>
          </div>
          <p v-if="!validTimes" class="text-dimmed -mt-2 text-xs">La hora de fin debe ser posterior a la de inicio.</p>

          <!-- motivo -->
          <div>
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Motivo (opcional)</label>
            <UInput v-model="reason" placeholder="Médico, recado, descanso…" icon="i-lucide-pencil" class="w-full" />
          </div>
        </div>

        <footer class="border-default flex items-center justify-end gap-3 border-t px-5 py-3.5">
          <UButton color="neutral" variant="soft" size="lg" @click="emit('update:open', false)">Cancelar</UButton>
          <UButton :disabled="!canSubmit" :loading="saving" color="primary" size="lg" icon="i-lucide-lock" @click="submit">Bloquear</UButton>
        </footer>
      </div>
    </div>
  </Transition>
</template>
