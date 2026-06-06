<script setup lang="ts">
import { initials, formatDuration, formatPrice, fmtDate } from '~~/lib/format'
import { generateSlots, resolveDayTimetable, isOnVacation } from '~~/lib/slots'
import { WEEKDAYS, effectiveDuration, type Weekday, type Service, type Barber, type FixedAppointment } from '~~/schemas'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const toast = useToast()
const { services } = useServices()
const { active: barbers } = useBarbers()
const { clients } = useClients()
const { settings } = useSettings()
const { fixed, create, update, removeSeries } = useFixedAppointments()

// día de semana ('mon'..'sun') -> nº día JS (0=dom..6=sáb), para fabricar una fecha
// representativa de ese weekday y calcular sus huecos según el horario.
const WEEKDAY_TO_JS: Record<Weekday, number> = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 }
function nextDateForWeekday(wd: Weekday): Date {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const d = new Date(today)
  d.setDate(d.getDate() + ((WEEKDAY_TO_JS[wd] - d.getDay() + 7) % 7))
  return d
}

const DAY_LABELS: Record<Weekday, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
}

const clientId = ref('')
const clientQuery = ref('')
const service = ref<Service | null>(null)
const barber = ref<Barber | null>(null)
const weekday = ref<Weekday>('tue')
const time = ref('10:00')
const saving = ref(false)
// id de la serie que se está editando (null = creando una nueva).
const editingId = ref<string | null>(null)

function resetForm() {
  clientId.value = ''
  clientQuery.value = ''
  service.value = null
  barber.value = null
  weekday.value = 'tue'
  time.value = '10:00'
  editingId.value = null
}

watch(
  () => props.open,
  (o) => {
    if (o) resetForm()
  },
)

// Carga una serie existente en el formulario para editarla.
function startEdit(f: FixedAppointment) {
  editingId.value = f.id
  clientId.value = f.clientId
  service.value = services.value.find((s) => s.id === f.serviceId) ?? null
  barber.value = barbers.value.find((b) => b.id === f.barberId) ?? null
  weekday.value = f.weekday
  time.value = f.time
}

const filteredClients = computed(() => {
  const q = clientQuery.value.trim().toLowerCase()
  const list = [...clients.value].sort((a, b) => (a.name ?? '').localeCompare(b.name ?? ''))
  if (!q) return list.slice(0, 6)
  return list.filter((c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)).slice(0, 6)
})
const selectedClient = computed(() => clients.value.find((c) => c.id === clientId.value) ?? null)
const bookable = computed(() => services.value.filter((s) => !s.isPrivate))
const eligibleBarbers = computed(() =>
  service.value ? barbers.value.filter((b) => b.servicesOffered.includes(service.value!.id)) : barbers.value,
)

// Huecos válidos para el weekday elegido = (horario local ∩ horario barbero) con
// el paso configurado y respetando la duración. Sin "busy" (varía cada semana) ni
// filtro de pasado (es una plantilla recurrente). Devuelve horas "HH:mm".
const slotTimes = computed<string[]>(() => {
  if (!service.value || !barber.value || !settings.value) return []
  const date = nextDateForWeekday(weekday.value)
  if (settings.value.daysClosed?.includes(weekday.value)) return []
  if (isOnVacation(date, barber.value.vacations ?? [])) return []
  const slots = generateSlots({
    day: date,
    durationMinutes: effectiveDuration(service.value, barber.value.id),
    localTimetable: resolveDayTimetable(settings.value.timetable ?? {}, date),
    barberTimetable: resolveDayTimetable(barber.value.timetable ?? {}, date),
    busy: [],
    stepMinutes: settings.value.slotStepMinutes ?? 30,
    now: new Date(0), // evita que se descarten huecos "pasados" si el weekday es hoy
  })
  return slots.map((s) => fmtDate(s, 'HH:mm'))
})
// Días de la semana con al menos un hueco (para deshabilitar los cerrados).
const openWeekdays = computed<Set<Weekday>>(() => {
  const set = new Set<Weekday>()
  if (!service.value || !barber.value || !settings.value) return set
  for (const wd of WEEKDAYS) {
    if (settings.value.daysClosed?.includes(wd)) continue
    const date = nextDateForWeekday(wd)
    if (isOnVacation(date, barber.value.vacations ?? [])) continue
    const has = generateSlots({
      day: date,
      durationMinutes: effectiveDuration(service.value, barber.value.id),
      localTimetable: resolveDayTimetable(settings.value.timetable ?? {}, date),
      barberTimetable: resolveDayTimetable(barber.value.timetable ?? {}, date),
      busy: [],
      stepMinutes: settings.value.slotStepMinutes ?? 30,
      now: new Date(0),
    }).length
    if (has) set.add(wd)
  }
  return set
})

// Si la hora seleccionada deja de ser un hueco válido (al cambiar día/servicio/
// barbero), se ajusta al primer hueco disponible.
watch(slotTimes, (list) => {
  if (!list.includes(time.value)) time.value = list[0] ?? ''
})

const canSubmit = computed(
  () => !!(clientId.value && service.value && barber.value && time.value && slotTimes.value.includes(time.value)),
)

function nameOf(id: string, kind: 'client' | 'barber' | 'service') {
  if (kind === 'client') return clients.value.find((c) => c.id === id)?.name ?? 'Cliente'
  if (kind === 'barber') return barbers.value.find((b) => b.id === id)?.name ?? 'Barbero'
  return services.value.find((s) => s.id === id)?.name ?? 'Servicio'
}

async function submit() {
  if (!canSubmit.value || !service.value || !barber.value) return
  saving.value = true
  try {
    const input = {
      clientId: clientId.value,
      barberId: barber.value.id,
      serviceId: service.value.id,
      weekday: weekday.value,
      time: time.value,
      active: true,
    }
    const res = editingId.value ? await update(editingId.value, input) : await create(input)
    const verb = editingId.value ? 'actualizada' : 'creada'
    if (res.skipped.length) {
      // Algún día ya tenía una cita: se crea la serie igualmente, omitiendo esos días.
      const days = res.skipped.map((d) => fmtDate(d, 'd MMM')).join(', ')
      toast.add({
        title: `Cita fija ${verb} · ${res.skipped.length} día(s) omitido(s)`,
        description: `Ya había una cita en: ${days}. Se ha respetado y esos días se han dejado libres de la serie.`,
        icon: 'i-lucide-triangle-alert',
        color: 'warning',
        duration: 8000,
      })
    } else {
      toast.add({
        title: `Cita fija ${verb}`,
        description: `Se han generado ${res.created} citas (próximas 12 semanas).`,
        icon: 'i-lucide-check',
        color: 'success',
      })
    }
    resetForm()
  } catch (e) {
    toast.add({ title: 'No se pudo guardar', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function del(id: string) {
  if (!confirm('¿Eliminar esta cita fija? Se borran sus citas futuras (las pasadas quedan).')) return
  await removeSeries(id)
  toast.add({ title: 'Cita fija eliminada', icon: 'i-lucide-trash-2' })
}
</script>

<template>
  <Transition enter-active-class="transition-opacity" leave-active-class="transition-opacity" enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center" @click="emit('update:open', false)">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div class="border-default bg-default relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border sm:rounded-3xl" @click.stop>
        <header class="border-default flex items-center justify-between border-b px-5 py-4">
          <div>
            <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Recurrentes</p>
            <h2 class="font-display text-xl">Citas fijas</h2>
          </div>
          <button type="button" aria-label="Cerrar" class="text-muted flex size-8 items-center justify-center" @click="emit('update:open', false)"><UIcon name="i-lucide-x" class="size-5" /></button>
        </header>

        <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <!-- cliente -->
          <div>
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Cliente</label>
            <div v-if="selectedClient" class="border-primary/30 bg-primary/5 flex items-center gap-3 rounded-xl border p-3">
              <div class="bg-elevated border-default flex size-9 items-center justify-center rounded-full border text-xs font-semibold">{{ initials(selectedClient.name) }}</div>
              <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold">{{ selectedClient.name }}</p></div>
              <button type="button" class="text-primary text-xs font-semibold" @click="clientId = ''">Cambiar</button>
            </div>
            <template v-else>
              <UInput v-model="clientQuery" placeholder="Buscar cliente…" icon="i-lucide-search" class="w-full" />
              <div v-if="filteredClients.length" class="border-default mt-2 max-h-40 overflow-y-auto rounded-xl border">
                <button v-for="c in filteredClients" :key="c.id" type="button" class="border-default hover:bg-elevated flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0" @click="clientId = c.id">
                  <div class="bg-elevated border-default flex size-8 items-center justify-center rounded-full border text-[0.65rem] font-semibold">{{ initials(c.name) }}</div>
                  <span class="truncate text-sm font-medium">{{ c.name }}</span>
                </button>
              </div>
            </template>
          </div>

          <!-- servicio -->
          <div>
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Servicio</label>
            <div class="grid grid-cols-2 gap-2">
              <button v-for="s in bookable" :key="s.id" type="button" class="rounded-xl border p-2.5 text-left" :class="service?.id === s.id ? 'border-primary/40 bg-primary/10' : 'border-default bg-muted'" @click="service = s; barber = null">
                <p class="text-sm font-semibold">{{ s.name }}</p>
                <p class="text-dimmed font-mono text-[0.65rem]">{{ formatDuration(s.durationMinutes) }} · {{ formatPrice(s.basePrice) }}</p>
              </button>
            </div>
          </div>

          <!-- barbero -->
          <div v-if="service">
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Barbero</label>
            <div class="flex flex-wrap gap-2">
              <button v-for="b in eligibleBarbers" :key="b.id" type="button" class="flex items-center gap-2 rounded-full border px-3 py-1.5" :class="barber?.id === b.id ? 'border-primary/40 bg-primary/10' : 'border-default bg-muted'" @click="barber = b">
                <span class="size-2.5 rounded-full" :style="{ background: b.color }" /><span class="text-sm font-medium">{{ b.name }}</span>
              </button>
            </div>
          </div>

          <!-- día (solo los abiertos para ese barbero/servicio) -->
          <div>
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Cada</label>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="d in WEEKDAYS"
                :key="d"
                type="button"
                :disabled="!!service && !!barber && !openWeekdays.has(d)"
                class="rounded-lg border px-2.5 py-1.5 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-35"
                :class="weekday === d ? 'border-primary bg-primary text-inverted' : 'border-default bg-muted text-toned'"
                @click="weekday = d"
              >
                {{ DAY_LABELS[d] }}
              </button>
            </div>
          </div>

          <!-- hora: huecos reales según horario + paso (no campo libre) -->
          <div>
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Hora</label>
            <p v-if="!service || !barber" class="text-dimmed text-xs">Elige servicio y barbero para ver los huecos.</p>
            <div v-else-if="slotTimes.length" class="grid grid-cols-4 gap-1.5 sm:grid-cols-6">
              <button
                v-for="t in slotTimes"
                :key="t"
                type="button"
                class="rounded-lg border py-1.5 text-center font-mono text-xs"
                :class="time === t ? 'border-primary bg-primary text-inverted' : 'border-default bg-muted text-toned'"
                @click="time = t"
              >
                {{ t }}
              </button>
            </div>
            <p v-else class="text-dimmed text-xs">Ese día no hay horario disponible para este barbero.</p>
          </div>

          <div class="flex gap-2">
            <UButton v-if="editingId" color="neutral" variant="soft" size="lg" icon="i-lucide-x" @click="resetForm">Cancelar</UButton>
            <UButton :disabled="!canSubmit" :loading="saving" color="primary" size="lg" block :icon="editingId ? 'i-lucide-check' : 'i-lucide-repeat'" @click="submit">{{ editingId ? 'Guardar cambios' : 'Crear cita fija' }}</UButton>
          </div>
          <p v-if="editingId" class="text-dimmed text-center text-xs">Editando una serie: se regeneran sus próximas 12 semanas (las citas pasadas se conservan).</p>

          <!-- existentes -->
          <div v-if="fixed.length">
            <p class="text-dimmed mb-2 font-mono text-[0.6rem] tracking-widest uppercase">Activas</p>
            <div class="space-y-2">
              <div v-for="f in fixed" :key="f.id" class="flex items-center gap-3 rounded-xl border p-3" :class="editingId === f.id ? 'border-primary/40 bg-primary/10' : 'border-default bg-muted'">
                <UIcon name="i-lucide-repeat" class="text-primary size-4 shrink-0" />
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">{{ nameOf(f.clientId, 'client') }} · {{ DAY_LABELS[f.weekday] }} {{ f.time }}</p>
                  <p class="text-dimmed truncate text-xs">{{ nameOf(f.serviceId, 'service') }} · {{ nameOf(f.barberId, 'barber') }}</p>
                </div>
                <button type="button" class="text-muted hover:text-primary flex size-8 items-center justify-center" aria-label="Editar" @click="startEdit(f)"><UIcon name="i-lucide-pencil" class="size-4" /></button>
                <button type="button" class="text-error/80 hover:text-error flex size-8 items-center justify-center" aria-label="Eliminar" @click="del(f.id)"><UIcon name="i-lucide-trash-2" class="size-4" /></button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>
