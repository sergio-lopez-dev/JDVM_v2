<script setup lang="ts">
import { effectivePrice, effectiveDuration, type Service, type Barber } from '~~/schemas'
import { generateSlots, resolveDayTimetable } from '~~/lib/slots'
import { toDate } from '~~/lib/datetime'
import { fmtDate, formatPrice, formatDuration, initials } from '~~/lib/format'

const props = defineProps<{
  open: boolean
  presetClientId?: string
  presetDate?: Date
}>()
const emit = defineEmits<{ 'update:open': [boolean]; created: [] }>()

const toast = useToast()
const { services } = useServices()
const { active: barbers } = useBarbers()
const { clients } = useClients()
const { settings } = useSettings()
const { create, busyFor } = useAppointments()

const clientId = ref<string>('')
const clientQuery = ref('')
const service = ref<Service | null>(null)
const barber = ref<Barber | null>(null)
const date = ref<Date>(startOfToday())
const slot = ref<Date | null>(null)
const submitting = ref(false)
// Cliente NO registrado (walk-in): nombre + teléfono a mano, sin clientId.
const manualClient = ref(false)
const manualName = ref('')
const manualPhone = ref('')
// Fuera de horario: permite meter una hora libre (corte extra) saltándose los huecos.
const outOfHours = ref(false)
const manualTime = ref('10:00')

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Resetea el formulario cada vez que se abre.
watch(
  () => props.open,
  (o) => {
    if (o) {
      clientId.value = props.presetClientId ?? ''
      clientQuery.value = ''
      service.value = null
      barber.value = null
      date.value = props.presetDate ? new Date(props.presetDate) : startOfToday()
      date.value.setHours(0, 0, 0, 0)
      slot.value = null
      manualClient.value = false
      manualName.value = ''
      manualPhone.value = ''
      outOfHours.value = false
      manualTime.value = '10:00'
    }
  },
)

const bookableServices = computed(() => services.value.filter((s) => !s.isPrivate))
const eligibleBarbers = computed(() =>
  service.value
    ? barbers.value.filter((b) => b.servicesOffered.includes(service.value!.id))
    : barbers.value,
)

// Al elegir servicio, preselecciona el barbero por defecto del estudio si ofrece ese
// servicio (en vez de dejar al admin elegir siempre desde cero).
function pickService(s: Service) {
  service.value = s
  slot.value = null
  const defId = settings.value?.defaultBarberId
  barber.value = (defId && eligibleBarbers.value.find((b) => b.id === defId)) || null
}
const filteredClients = computed(() => {
  const q = clientQuery.value.trim().toLowerCase()
  const list = [...clients.value].sort((a, b) => a.name.localeCompare(b.name))
  if (!q) return list.slice(0, 8)
  return list.filter((c) => c.name?.toLowerCase().includes(q) || c.email?.toLowerCase().includes(q)).slice(0, 8)
})
const selectedClient = computed(() => clients.value.find((c) => c.id === clientId.value) ?? null)

const barberId = computed(() => barber.value?.id ?? null)
const busy = busyFor(barberId, date)
const slots = computed(() => {
  if (!service.value || !barber.value) return []
  const localTt = settings.value
    ? resolveDayTimetable(settings.value.timetable, date.value)
    : undefined
  const barberTt = resolveDayTimetable(barber.value.timetable, date.value)
  return generateSlots({
    day: date.value,
    durationMinutes: effectiveDuration(service.value, barberId.value ?? undefined),
    localTimetable: localTt,
    barberTimetable: barberTt,
    busy: busy.value.map((a) => ({ start: toDate(a.startsAt), end: toDate(a.endsAt) })),
    stepMinutes: settings.value?.slotStepMinutes ?? 15,
  })
})

const price = computed(() =>
  service.value ? effectivePrice(service.value, barberId.value ?? undefined) : 0,
)
const clientOk = computed(() => (manualClient.value ? !!manualName.value.trim() : !!clientId.value))
const timeOk = computed(() => (outOfHours.value ? /^\d{2}:\d{2}$/.test(manualTime.value) : !!slot.value))
const canSubmit = computed(() => !!(clientOk.value && service.value && barber.value && timeOk.value))

// Fecha + "HH:mm" -> Date (para la hora libre fuera de horario).
function dateAt(d: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const nd = new Date(d)
  nd.setHours(h ?? 0, m ?? 0, 0, 0)
  return nd
}

function setDateFromInput(v: string) {
  const [y, m, d] = v.split('-').map(Number)
  if (y && m && d) {
    const nd = new Date(y, m - 1, d)
    nd.setHours(0, 0, 0, 0)
    date.value = nd
    slot.value = null
  }
}
const dateInputValue = computed(() => fmtDate(date.value, 'yyyy-MM-dd'))

async function confirm() {
  if (!canSubmit.value || !service.value || !barber.value) return
  const startsAt = outOfHours.value ? dateAt(date.value, manualTime.value) : slot.value
  if (!startsAt) return
  submitting.value = true
  try {
    const endsAt = new Date(startsAt.getTime() + effectiveDuration(service.value, barber.value.id) * 60_000)
    await create({
      clientId: manualClient.value ? '' : clientId.value,
      ...(manualClient.value
        ? { clientName: manualName.value.trim(), ...(manualPhone.value.trim() ? { clientPhone: manualPhone.value.trim() } : {}) }
        : {}),
      barberId: barber.value.id,
      serviceId: service.value.id,
      startsAt,
      endsAt,
      status: 'booked',
      priceSnapshot: price.value,
      paymentMethod: 'cash',
      isRecurring: false,
    })
    toast.add({ title: 'Cita creada', icon: 'i-lucide-check', color: 'success' })
    emit('created')
    emit('update:open', false)
  } catch (e) {
    toast.add({ title: 'No se pudo crear', description: (e as Error).message, color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <Transition
    enter-active-class="transition-opacity"
    leave-active-class="transition-opacity"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
      @click="emit('update:open', false)"
    >
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        class="border-default bg-default relative flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl border sm:rounded-3xl"
        @click.stop
      >
        <header class="border-default flex items-center justify-between border-b px-5 py-4">
          <div>
            <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Nueva cita</p>
            <h2 class="font-display text-xl">Crear reserva</h2>
          </div>
          <button type="button" aria-label="Cerrar" class="text-muted flex size-8 items-center justify-center" @click="emit('update:open', false)">
            <UIcon name="i-lucide-x" class="size-5" />
          </button>
        </header>

        <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <!-- cliente -->
          <div>
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Cliente</label>
            <!-- control segmentado: cliente registrado vs. a mano (walk-in) -->
            <div class="border-default bg-muted mb-2.5 grid grid-cols-2 gap-1 rounded-xl border p-1">
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition"
                :class="!manualClient ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-default'"
                @click="manualClient = false; manualName = ''; manualPhone = ''"
              >
                <UIcon name="i-lucide-user-round-check" class="size-4" />Registrado
              </button>
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition"
                :class="manualClient ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-default'"
                @click="manualClient = true; clientId = ''"
              >
                <UIcon name="i-lucide-user-round-plus" class="size-4" />Sin registrar
              </button>
            </div>
            <!-- cliente NO registrado: nombre + teléfono a mano -->
            <div v-if="manualClient" class="space-y-2">
              <UInput v-model="manualName" placeholder="Nombre del cliente" icon="i-lucide-user" size="md" class="w-full" />
              <UInput v-model="manualPhone" type="tel" inputmode="numeric" placeholder="Teléfono (opcional)" icon="i-lucide-phone" size="md" class="w-full" />
            </div>
            <template v-else>
              <div v-if="selectedClient" class="border-primary/30 bg-primary/5 flex items-center gap-3 rounded-xl border p-3">
                <div class="bg-elevated border-default flex size-9 items-center justify-center rounded-full border text-xs font-semibold">{{ initials(selectedClient.name) }}</div>
                <div class="min-w-0 flex-1"><p class="truncate text-sm font-semibold">{{ selectedClient.name }}</p><p class="text-dimmed truncate text-xs">{{ selectedClient.email }}</p></div>
                <button type="button" class="text-primary text-xs font-semibold" @click="clientId = ''">Cambiar</button>
              </div>
              <template v-else>
                <UInput v-model="clientQuery" placeholder="Buscar cliente…" icon="i-lucide-search" size="md" class="w-full" />
                <div v-if="filteredClients.length" class="border-default mt-2 max-h-44 overflow-y-auto rounded-xl border">
                  <button
                    v-for="c in filteredClients"
                    :key="c.id"
                    type="button"
                    class="border-default hover:bg-elevated flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0"
                    @click="clientId = c.id"
                  >
                    <div class="bg-elevated border-default flex size-8 items-center justify-center rounded-full border text-[0.65rem] font-semibold">{{ initials(c.name) }}</div>
                    <div class="min-w-0"><p class="truncate text-sm font-medium">{{ c.name }}</p><p class="text-dimmed truncate text-[0.7rem]">{{ c.email }}</p></div>
                  </button>
                </div>
              </template>
            </template>
          </div>

          <!-- servicio -->
          <div>
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Servicio</label>
            <div class="grid grid-cols-2 gap-2">
              <button
                v-for="s in bookableServices"
                :key="s.id"
                type="button"
                class="rounded-xl border p-2.5 text-left"
                :class="service?.id === s.id ? 'border-primary/40 bg-primary/10' : 'border-default bg-muted'"
                @click="pickService(s)"
              >
                <p class="text-sm font-semibold">{{ s.name }}</p>
                <p class="text-dimmed font-mono text-[0.65rem]">{{ formatDuration(s.durationMinutes) }} · {{ formatPrice(s.basePrice) }}</p>
              </button>
            </div>
          </div>

          <!-- barbero -->
          <div v-if="service">
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Barbero</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="b in eligibleBarbers"
                :key="b.id"
                type="button"
                class="flex items-center gap-2 rounded-full border px-3 py-1.5"
                :class="barber?.id === b.id ? 'border-primary/40 bg-primary/10' : 'border-default bg-muted'"
                @click="barber = b; slot = null"
              >
                <span class="size-2.5 rounded-full" :style="{ background: b.color }" />
                <span class="text-sm font-medium">{{ b.name }}</span>
              </button>
            </div>
          </div>

          <!-- fecha + hueco -->
          <div v-if="service && barber">
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Fecha y hora</label>
            <input
              type="date"
              :value="dateInputValue"
              class="border-default bg-muted text-default mb-2.5 w-full rounded-xl border px-3 py-2.5 text-sm [color-scheme:dark]"
              @input="setDateFromInput(($event.target as HTMLInputElement).value)"
            />
            <!-- control segmentado: huecos del horario vs. hora libre (corte extra) -->
            <div class="border-default bg-muted mb-2.5 grid grid-cols-2 gap-1 rounded-xl border p-1">
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition"
                :class="!outOfHours ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-default'"
                @click="outOfHours = false"
              >
                <UIcon name="i-lucide-clock" class="size-4" />Huecos
              </button>
              <button
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition"
                :class="outOfHours ? 'bg-primary text-inverted shadow-sm' : 'text-muted hover:text-default'"
                @click="outOfHours = true; slot = null"
              >
                <UIcon name="i-lucide-clock-plus" class="size-4" />Fuera de horario
              </button>
            </div>
            <!-- hora libre (corte extra fuera del horario): se salta huecos y horario -->
            <template v-if="outOfHours">
              <input
                v-model="manualTime"
                type="time"
                class="border-default bg-muted text-default w-full rounded-xl border px-3 py-2.5 text-sm [color-scheme:dark]"
              />
              <p class="text-dimmed mt-2 text-xs">Corte extra: se ignoran el horario y los huecos. Puede solaparse con otra cita.</p>
            </template>
            <template v-else>
              <div v-if="slots.length" class="grid grid-cols-4 gap-2">
                <button
                  v-for="s in slots"
                  :key="s.toISOString()"
                  type="button"
                  class="rounded-lg border py-2 text-center font-mono text-sm font-semibold"
                  :class="slot?.getTime() === s.getTime() ? 'border-primary bg-primary text-inverted' : 'border-default bg-muted'"
                  @click="slot = s"
                >{{ fmtDate(s, 'HH:mm') }}</button>
              </div>
              <p v-else class="text-dimmed py-3 text-center text-sm">No hay huecos ese día. Usa “Fuera de horario” para un corte extra.</p>
            </template>
          </div>
        </div>

        <footer class="border-default flex items-center gap-3 border-t px-5 py-3.5">
          <div class="flex-1"><p class="text-dimmed font-mono text-[0.6rem] uppercase">Total</p><p class="font-display text-xl">{{ formatPrice(price) }}</p></div>
          <UButton :disabled="!canSubmit" :loading="submitting" color="primary" size="lg" icon="i-lucide-check" @click="confirm">Crear cita</UButton>
        </footer>
      </div>
    </div>
  </Transition>
</template>
