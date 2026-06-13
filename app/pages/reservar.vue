<script setup lang="ts">
import confetti from 'canvas-confetti'
import { effectivePrice, effectiveDuration, type Service, type Barber } from '~~/schemas'
import { generateSlots, resolveDayTimetable, isOnVacation } from '~~/lib/slots'
import { toDate, weekdayOf } from '~~/lib/datetime'
import { fmtDate, formatPrice, formatDuration, initials } from '~~/lib/format'

definePageMeta({ layout: 'booking', middleware: 'auth' })
useHead({ title: 'Reservar' })

const route = useRoute()
const user = useCurrentUser()
const { client } = useCurrentClient()
const banned = computed(() => !!client.value?.banned)
// El estudio puede cerrar las reservas (admin → Ajustes). Si está cerrado, el cliente
// no puede coger nuevas citas (enforcement a nivel de app, como el veto).
const bookingsClosed = computed(() => settings.value?.acceptingAppointments === false)
const toast = useToast()
const { publicServices } = useServices()
const { active: barbers } = useBarbers()
const { settings } = useSettings()
const { create, inRange } = useAppointments()
const { studio, name: studioName, codePrefix } = useStudio()
const studioPlace = computed(() => studio.value.address || studio.value.city || studioName.value)
const cancelHours = computed(() => settings.value?.cancellationWindowHours ?? 4)

type Step = 0 | 1 | 2 | 'done'
const step = ref<Step>(0)

const selectedService = ref<Service | null>(null)
const anyBarber = ref(true)
const selectedBarber = ref<Barber | null>(null)
const selectedDate = ref<Date>(startOfToday())
const selectedSlot = ref<Date | null>(null)
const paymentMethod = ref<'cash' | 'revolut'>('cash')
const submitting = ref(false)
const bookingCode = ref('')

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

// Preselección de barbero (una sola vez): por query (?barber=slug) desde el detalle,
// o el barbero por defecto del estudio (settings.defaultBarberId). Si hay barbero por
// defecto, la reserva arranca con "Barbero concreto" marcado y ese barbero elegido,
// en vez de "cualquiera". Se espera a que lleguen `settings` antes de decidir para no
// perder el barbero por defecto por una carrera de carga.
let barberPreselected = false
watch(
  [barbers, settings, () => route.query.barber as string | undefined],
  ([list, s, slug]) => {
    if (barberPreselected || !list.length) return
    if (slug) {
      const b = list.find((x) => x.slug === slug)
      if (b) {
        selectedBarber.value = b
        anyBarber.value = false
        barberPreselected = true
      }
      return
    }
    // Sin query: necesitamos settings para saber si hay barbero por defecto.
    if (!s) return
    const defId = s.defaultBarberId
    if (defId) {
      const b = list.find((x) => x.id === defId)
      if (b) {
        selectedBarber.value = b
        anyBarber.value = false // → toggle "Barbero concreto" marcado
      }
    }
    barberPreselected = true
  },
  { immediate: true },
)

// Servicios agrupados (populares = primeros / premium).
const populares = computed(() => publicServices.value.filter((s) => s.category !== 'premium'))
const premium = computed(() => publicServices.value.filter((s) => s.category === 'premium'))

// Barberos que ofrecen el servicio elegido.
const eligibleBarbers = computed(() =>
  selectedService.value
    ? barbers.value.filter((b) => b.servicesOffered.includes(selectedService.value!.id))
    : barbers.value,
)

// Slots disponibles.
const selectedBarberId = computed(() =>
  anyBarber.value || !selectedBarber.value ? null : selectedBarber.value.id,
)
const busy = useAppointments().busyFor(selectedBarberId, selectedDate)

// ¿El barbero concreto está de vacaciones ese día? (vacations llegan como Timestamps).
function barberOnVacation(b: Barber, date: Date) {
  const vacs = (b.vacations ?? []).map((v) => ({ start: toDate(v.start), end: toDate(v.end) }))
  return isOnVacation(date, vacs)
}

const slots = computed(() => {
  const svc = selectedService.value
  if (!svc) return []
  // Si el barbero elegido está de vacaciones ese día, no hay huecos.
  if (selectedBarber.value && !anyBarber.value && barberOnVacation(selectedBarber.value, selectedDate.value)) {
    return []
  }
  const localTt = settings.value
    ? resolveDayTimetable(settings.value.timetable, selectedDate.value)
    : undefined
  const barberTt =
    selectedBarber.value && !anyBarber.value
      ? resolveDayTimetable(selectedBarber.value.timetable, selectedDate.value)
      : undefined
  return generateSlots({
    day: selectedDate.value,
    durationMinutes: effectiveDuration(svc, selectedBarberId.value ?? undefined),
    localTimetable: localTt,
    barberTimetable: barberTt,
    busy: busy.value.map((a) => ({ start: toDate(a.startsAt), end: toDate(a.endsAt) })),
    stepMinutes: settings.value?.slotStepMinutes ?? 30,
  })
})

const isClosed = (d: Date) =>
  (settings.value?.daysClosed?.includes(weekdayOf(d)) ?? false) ||
  (!anyBarber.value && !!selectedBarber.value && barberOnVacation(selectedBarber.value, d))

const price = computed(() =>
  selectedService.value
    ? effectivePrice(selectedService.value, selectedBarberId.value ?? undefined)
    : 0,
)
const duration = computed(() =>
  selectedService.value
    ? effectiveDuration(selectedService.value, selectedBarberId.value ?? undefined)
    : undefined,
)

function pickService(s: Service) {
  selectedService.value = s
  selectedSlot.value = null
}
function pickDay(d: Date) {
  selectedDate.value = d
  selectedSlot.value = null
}
function goFecha() {
  if (selectedService.value) step.value = 1
}
function goConfirmar() {
  if (selectedSlot.value) step.value = 2
}

async function confirm() {
  const svc = selectedService.value
  const slot = selectedSlot.value
  if (!svc || !slot || !user.value) return
  if (banned.value) {
    toast.add({ title: 'No puedes reservar', description: 'Tu cuenta está bloqueada para nuevas reservas. Contacta con el estudio.', color: 'error', icon: 'i-lucide-ban' })
    return
  }
  if (bookingsClosed.value) {
    toast.add({ title: 'Reservas cerradas', description: 'El estudio no está aceptando nuevas reservas en este momento.', color: 'error', icon: 'i-lucide-calendar-off' })
    return
  }
  submitting.value = true
  try {
    let barber = anyBarber.value ? null : selectedBarber.value
    if (!barber) barber = eligibleBarbers.value[0] ?? barbers.value[0] ?? null
    if (!barber) throw new Error('No hay barberos disponibles.')
    const endsAt = new Date(slot.getTime() + effectiveDuration(svc, barber.id) * 60_000)
    const ref = await create({
      clientId: user.value.uid,
      barberId: barber.id,
      serviceId: svc.id,
      startsAt: slot,
      endsAt,
      status: 'booked',
      priceSnapshot: effectivePrice(svc, barber.id),
      paymentMethod: paymentMethod.value,
      isRecurring: false,
    })
    bookingCode.value = `${codePrefix.value}-${ref.id.slice(-4).toUpperCase()}`
    selectedBarber.value = barber
    void confetti({ particleCount: 120, spread: 70, origin: { y: 0.3 }, colors: ['#C2A24E', '#DCC07A', '#6FA98A'] })
    step.value = 'done'
  } catch (e) {
    toast.add({ title: 'No se pudo reservar', description: (e as Error).message, color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    submitting.value = false
  }
}

const steps = ['Servicio', 'Fecha', 'Confirmar']

// ----- Soporte escritorio (vista unificada + calendario mensual) -----
function startOfMonth(d: Date) {
  const x = new Date(d)
  x.setDate(1)
  x.setHours(0, 0, 0, 0)
  return x
}
const viewMonth = ref(startOfMonth(new Date()))
const todayStart = startOfToday()
const weekdayLabels = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

// Antelación máxima para reservar (configurable en admin; def. 60 días ≈ 2 meses).
const maxBookingDate = computed(() => {
  const d = startOfToday()
  d.setDate(d.getDate() + (settings.value?.bookingHorizonDays ?? 60))
  return d
})
const canNextMonth = computed(() => viewMonth.value.getTime() < startOfMonth(maxBookingDate.value).getTime())

const monthGrid = computed(() => {
  const first = viewMonth.value
  const year = first.getFullYear()
  const month = first.getMonth()
  const lead = (first.getDay() + 6) % 7 // semana en lunes
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  return cells
})
function shiftMonth(delta: number) {
  const x = new Date(viewMonth.value)
  x.setMonth(x.getMonth() + delta)
  viewMonth.value = startOfMonth(x)
}
const canPrevMonth = computed(() => viewMonth.value.getTime() > startOfMonth(new Date()).getTime())
function dayDisabled(d: Date) {
  return d.getTime() < todayStart.getTime() || d.getTime() > maxBookingDate.value.getTime() || isClosed(d)
}
function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

// ----- Días completos (todos los huecos ocupados) en el calendario -----
// Citas reservadas del mes visible (todos los barberos). Con ellas se marca en rojo
// cada día sin ningún hueco libre para el servicio (y barbero) elegido.
const monthRangeEnd = computed(() => {
  const d = new Date(viewMonth.value)
  d.setMonth(d.getMonth() + 1)
  return d
})
const monthAppts = inRange(viewMonth, monthRangeEnd)

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`

// Mapa barbero+día → intervalos ocupados (reservados) ese día.
const busyByBarberDay = computed(() => {
  const map = new Map<string, { start: Date; end: Date }[]>()
  for (const a of monthAppts.value) {
    if (a.status !== 'booked') continue
    const start = toDate(a.startsAt)
    const k = `${a.barberId}|${dayKey(start)}`
    const interval = { start, end: toDate(a.endsAt) }
    const arr = map.get(k)
    if (arr) arr.push(interval)
    else map.set(k, [interval])
  }
  return map
})

function barberHasSlots(b: Barber, d: Date): boolean {
  const svc = selectedService.value
  if (!svc) return true
  if (barberOnVacation(b, d)) return false
  const localTt = settings.value ? resolveDayTimetable(settings.value.timetable, d) : undefined
  const barberTt = resolveDayTimetable(b.timetable, d)
  const free = generateSlots({
    day: d,
    durationMinutes: effectiveDuration(svc, b.id),
    localTimetable: localTt,
    barberTimetable: barberTt,
    busy: busyByBarberDay.value.get(`${b.id}|${dayKey(d)}`) ?? [],
    stepMinutes: settings.value?.slotStepMinutes ?? 30,
  })
  return free.length > 0
}

// Días del mes sin disponibilidad. Solo se calcula con un servicio elegido (sin él
// no se conoce la duración). Con "cualquiera" un día está completo solo si NINGÚN
// barbero elegible tiene hueco.
const fullDays = computed(() => {
  const set = new Set<string>()
  if (!selectedService.value) return set
  for (const d of monthGrid.value) {
    if (!d || dayDisabled(d)) continue
    const full = anyBarber.value
      ? eligibleBarbers.value.length > 0 && eligibleBarbers.value.every((b) => !barberHasSlots(b, d))
      : !!selectedBarber.value && !barberHasSlots(selectedBarber.value, d)
    if (full) set.add(dayKey(d))
  }
  return set
})
const isDayFull = (d: Date) => fullDays.value.has(dayKey(d))

// Clase de cada celda del calendario según su estado (seleccionado / completo / normal).
function dayClass(d: Date) {
  if (sameDay(d, selectedDate.value)) return 'bg-primary text-inverted font-bold'
  if (isDayFull(d)) return 'bg-error/10 text-error/70 font-medium line-through'
  return 'text-default hover:bg-elevated font-medium'
}

const slotEnd = computed(() =>
  selectedSlot.value && selectedService.value
    ? new Date(
        selectedSlot.value.getTime() +
          effectiveDuration(selectedService.value, selectedBarberId.value ?? undefined) * 60_000,
      )
    : null,
)
const barberLabel = computed(() =>
  anyBarber.value || !selectedBarber.value ? 'Cualquiera disponible' : selectedBarber.value.name,
)

// Vista de escritorio combina servicio+barbero+fecha en un solo paso.
function goConfirmDesktop() {
  if (selectedService.value && selectedSlot.value) step.value = 2
}
const dLabels = ['Servicio y barbero', 'Fecha y hora', 'Confirmar']
const dStep = computed(() => (step.value === 2 ? 2 : 0))

// Enlace "Añadir a Google Calendar" para la pantalla de éxito.
const gcalUrl = computed(() => {
  if (!selectedSlot.value || !slotEnd.value || !selectedService.value) return ''
  const stamp = (d: Date) => fmtDate(d, "yyyyMMdd'T'HHmmss")
  const text = encodeURIComponent(`${selectedService.value.name} · ${studioName.value}`)
  const loc = encodeURIComponent(`${studioName.value}${studioPlace.value ? `, ${studioPlace.value}` : ''}`)
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${stamp(selectedSlot.value)}/${stamp(slotEnd.value)}&location=${loc}`
})
</script>

<template>
  <div class="contents">
  <!-- aviso de cuenta vetada: no puede reservar -->
  <div v-if="banned" class="border-error/40 bg-error/10 text-error fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur">
    <UIcon name="i-lucide-ban" class="size-5 shrink-0" />
    <p class="text-sm">Tu cuenta está bloqueada para nuevas reservas. Contacta con el estudio para resolverlo.</p>
  </div>
  <!-- aviso de reservas cerradas por el estudio -->
  <div v-else-if="bookingsClosed" class="border-error/40 bg-error/10 text-error fixed inset-x-3 top-3 z-50 mx-auto flex max-w-md items-center gap-3 rounded-xl border px-4 py-3 shadow-lg backdrop-blur">
    <UIcon name="i-lucide-calendar-off" class="size-5 shrink-0" />
    <p class="text-sm">El estudio no está aceptando nuevas reservas en este momento. Inténtalo más tarde o contacta con el estudio.</p>
  </div>
  <!-- ====================== MÓVIL ====================== -->
  <div class="flex flex-1 flex-col lg:hidden">
    <!-- ÉXITO -->
    <template v-if="step === 'done'">
      <div class="flex flex-1 flex-col items-center justify-center px-8 text-center">
        <div class="bg-primary/15 border-primary/30 mb-6 flex size-24 items-center justify-center rounded-full border">
          <div class="bg-primary flex size-16 items-center justify-center rounded-full">
            <UIcon name="i-lucide-check" class="text-inverted size-9" />
          </div>
        </div>
        <h1 class="font-display text-4xl leading-tight">¡Cita confirmada!</h1>
        <p class="text-muted mt-2.5 max-w-xs text-sm leading-relaxed">
          Te esperamos el
          <span class="text-primary font-semibold">{{ fmtDate(selectedSlot!, "EEEE d 'a las' HH:mm") }}</span>.
        </p>

        <div class="border-default bg-muted mt-7 w-full overflow-hidden rounded-2xl text-left">
          <div class="flex items-center gap-3 p-4">
            <div class="bg-elevated border-default flex size-11 items-center justify-center rounded-full border text-sm font-semibold">
              {{ initials(selectedBarber?.name) }}
            </div>
            <div class="flex-1">
              <p class="text-sm font-semibold">{{ selectedService?.name }}</p>
              <p class="text-muted text-xs">con {{ selectedBarber?.name }}</p>
            </div>
            <p class="font-display text-xl">{{ formatPrice(price) }}</p>
          </div>
          <div class="border-default flex justify-between border-t border-dashed px-4 py-3">
            <div><p class="text-dimmed font-mono text-[0.55rem]">FECHA</p><p class="mt-0.5 text-sm font-semibold capitalize">{{ fmtDate(selectedSlot!, 'EEE d MMM') }}</p></div>
            <div><p class="text-dimmed font-mono text-[0.55rem]">HORA</p><p class="mt-0.5 text-sm font-semibold">{{ fmtDate(selectedSlot!, 'HH:mm') }}</p></div>
            <div><p class="text-dimmed font-mono text-[0.55rem]">CÓDIGO</p><p class="text-primary mt-0.5 font-mono text-sm font-semibold">{{ bookingCode }}</p></div>
          </div>
        </div>
      </div>
      <div class="space-y-2.5 px-5 pb-7">
        <UButton to="/app" color="primary" size="lg" block icon="i-lucide-calendar">Volver al inicio</UButton>
      </div>
    </template>

    <template v-else>
      <!-- app bar + stepper -->
      <header class="flex items-center justify-between px-5 pt-4 pb-2">
        <button
          type="button"
          aria-label="Atrás"
          class="border-default bg-elevated flex size-9 items-center justify-center rounded-xl border"
          @click="step === 0 ? $router.back() : (step = (step - 1) as Step)"
        >
          <UIcon name="i-lucide-chevron-left" class="size-5" />
        </button>
        <span class="font-display text-lg">Reservar</span>
        <span class="text-dimmed w-9 text-right font-mono text-xs">{{ (step as number) + 1 }}/3</span>
      </header>
      <div class="flex gap-1.5 px-5 pb-3">
        <div v-for="(s, i) in steps" :key="s" class="flex-1">
          <div class="h-[3px] rounded-full" :class="i <= (step as number) ? 'bg-primary' : 'bg-border'" />
          <p class="mt-1.5 text-[0.7rem]" :class="i === step ? 'text-default font-semibold' : 'text-dimmed'">{{ s }}</p>
        </div>
      </div>

      <!-- PASO 1: SERVICIO -->
      <div v-if="step === 0" class="flex-1 space-y-5 overflow-y-auto px-5 py-3">
        <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Lo más pedido</p>
        <div class="space-y-2.5">
          <button
            v-for="s in populares"
            :key="s.id"
            type="button"
            class="flex w-full items-center gap-3 rounded-xl border p-3.5 text-left"
            :class="selectedService?.id === s.id ? 'bg-primary/10 border-primary/30' : 'bg-muted border-default'"
            @click="pickService(s)"
          >
            <span
              class="flex size-5 shrink-0 items-center justify-center rounded-full border"
              :class="selectedService?.id === s.id ? 'bg-primary border-primary' : 'border-border'"
            >
              <UIcon v-if="selectedService?.id === s.id" name="i-lucide-check" class="text-inverted size-3" />
            </span>
            <div class="flex-1">
              <p class="text-sm font-semibold">{{ s.name }}</p>
              <p class="text-dimmed mt-0.5 text-xs">{{ s.description }}</p>
            </div>
            <div class="text-right">
              <p class="font-display text-xl">{{ formatPrice(s.basePrice) }}</p>
              <p class="text-dimmed font-mono text-[0.6rem]">{{ formatDuration(s.durationMinutes) }}</p>
            </div>
          </button>
        </div>
        <template v-if="premium.length">
          <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Premium</p>
          <div class="space-y-2.5">
            <button
              v-for="s in premium"
              :key="s.id"
              type="button"
              class="flex w-full items-center gap-3 rounded-xl border p-3.5 text-left"
              :class="selectedService?.id === s.id ? 'bg-primary/10 border-primary/30' : 'bg-muted border-default'"
              @click="pickService(s)"
            >
              <span class="flex size-5 shrink-0 items-center justify-center rounded-full border" :class="selectedService?.id === s.id ? 'bg-primary border-primary' : 'border-border'">
                <UIcon v-if="selectedService?.id === s.id" name="i-lucide-check" class="text-inverted size-3" />
              </span>
              <div class="flex-1">
                <p class="text-sm font-semibold">{{ s.name }}</p>
                <p class="text-dimmed mt-0.5 text-xs">{{ s.description }}</p>
              </div>
              <div class="text-right">
                <p class="font-display text-xl">{{ formatPrice(s.basePrice) }}</p>
                <p class="text-dimmed font-mono text-[0.6rem]">{{ formatDuration(s.durationMinutes) }}</p>
              </div>
            </button>
          </div>
        </template>
      </div>

      <!-- PASO 2: FECHA Y HORA -->
      <div v-else-if="step === 1" class="flex-1 space-y-5 overflow-y-auto px-5 py-3">
        <div class="bg-muted border-default flex items-center gap-3 rounded-xl border p-3.5">
          <span class="bg-primary size-2.5 shrink-0 rounded" />
          <div class="flex-1">
            <p class="text-sm font-semibold">{{ selectedService?.name }}</p>
            <p class="text-dimmed font-mono text-[0.65rem]">{{ formatDuration(duration) }} · {{ formatPrice(price) }}</p>
          </div>
          <button type="button" class="text-primary text-xs font-semibold" @click="step = 0">Cambiar</button>
        </div>

        <!-- barbero (selección directa, como en la web) -->
        <div>
          <p class="mb-3 text-sm font-semibold">Elige barbero</p>
          <div class="flex gap-3 overflow-x-auto pb-1">
            <button type="button" class="flex shrink-0 flex-col items-center gap-1.5" @click="anyBarber = true">
              <span
                class="flex size-12 items-center justify-center rounded-full border"
                :class="anyBarber ? 'border-primary bg-primary/15 text-primary ring-primary ring-2' : 'border-default bg-elevated text-muted'"
              >
                <UIcon name="i-lucide-sparkles" class="size-5" />
              </span>
              <span class="text-[0.7rem]" :class="anyBarber ? 'text-default font-semibold' : 'text-dimmed'">Cualquiera</span>
            </button>
            <button
              v-for="b in eligibleBarbers"
              :key="b.id"
              type="button"
              class="flex shrink-0 flex-col items-center gap-1.5"
              @click="anyBarber = false; selectedBarber = b"
            >
              <span class="rounded-full" :class="!anyBarber && selectedBarber?.id === b.id ? 'ring-primary ring-2 ring-offset-2 ring-offset-[var(--jdvm-bg-1)]' : ''">
                <UiAvatar :name="b.name" :src="b.photoUrl || null" :size="48" :ring="b.color" />
              </span>
              <span class="text-[0.7rem]" :class="!anyBarber && selectedBarber?.id === b.id ? 'text-default font-semibold' : 'text-dimmed'">{{ b.name.split(' ')[0] }}</span>
            </button>
          </div>
        </div>

        <!-- calendario mensual (navega a cualquier día, no solo esta semana) -->
        <div>
          <div class="mb-2.5 flex items-center justify-between">
            <button
              type="button"
              :disabled="!canPrevMonth"
              aria-label="Mes anterior"
              class="border-default bg-muted flex size-8 items-center justify-center rounded-lg border disabled:opacity-30"
              @click="shiftMonth(-1)"
            >
              <UIcon name="i-lucide-chevron-left" class="size-4" />
            </button>
            <span class="font-display text-base capitalize">{{ fmtDate(viewMonth, 'MMMM yyyy') }}</span>
            <button
              type="button"
              :disabled="!canNextMonth"
              aria-label="Mes siguiente"
              class="border-default bg-muted flex size-8 items-center justify-center rounded-lg border disabled:opacity-30"
              @click="shiftMonth(1)"
            >
              <UIcon name="i-lucide-chevron-right" class="size-4" />
            </button>
          </div>
          <div class="mb-1.5 grid grid-cols-7 gap-1">
            <div v-for="w in weekdayLabels" :key="w" class="text-dimmed text-center font-mono text-[0.6rem]">{{ w }}</div>
          </div>
          <div class="grid grid-cols-7 gap-1">
            <template v-for="(d, i) in monthGrid" :key="i">
              <div v-if="!d" />
              <button
                v-else
                type="button"
                :disabled="dayDisabled(d)"
                class="relative flex aspect-square items-center justify-center rounded-lg text-sm disabled:opacity-25"
                :class="dayClass(d)"
                @click="pickDay(d)"
              >
                {{ d.getDate() }}
                <span
                  v-if="!dayDisabled(d) && !sameDay(d, selectedDate)"
                  class="absolute bottom-1 size-1 rounded-full"
                  :class="isDayFull(d) ? 'bg-error/70' : 'bg-primary/60'"
                />
              </button>
            </template>
          </div>
          <p class="text-dimmed mt-2 flex items-center gap-1.5 text-[0.65rem]">
            <span class="bg-error/70 size-1.5 rounded-full" />Día completo (sin huecos)
          </p>
        </div>

        <!-- slots -->
        <div>
          <div class="mb-3 flex items-center gap-2">
            <span class="font-display text-base capitalize">{{ fmtDate(selectedDate, 'EEEE d') }}</span>
            <span class="bg-border h-px flex-1" />
            <span class="text-dimmed font-mono text-[0.65rem]">{{ slots.length }} huecos</span>
          </div>
          <div v-if="slots.length" class="grid grid-cols-3 gap-2.5">
            <button
              v-for="s in slots"
              :key="s.toISOString()"
              type="button"
              class="rounded-xl border py-2.5 text-center font-mono text-sm font-semibold"
              :class="selectedSlot?.getTime() === s.getTime() ? 'bg-primary border-primary text-inverted' : 'bg-muted border-default'"
              @click="selectedSlot = s"
            >
              {{ fmtDate(s, 'HH:mm') }}
            </button>
          </div>
          <p v-else class="text-dimmed py-4 text-center text-sm">No hay huecos ese día.</p>
        </div>

        <NuxtLink to="/lista-espera" class="border-default flex items-center gap-2.5 rounded-xl border border-dashed p-3.5">
          <UIcon name="i-lucide-bell" class="text-muted size-4" />
          <span class="text-muted text-xs">¿Sin tu hora ideal? <span class="text-primary font-semibold">Únete a la lista de espera</span></span>
        </NuxtLink>
      </div>

      <!-- PASO 3: CONFIRMAR -->
      <div v-else class="flex-1 space-y-5 overflow-y-auto px-5 py-3">
        <div class="flex items-center gap-3">
          <div class="border-primary/40 bg-elevated flex size-12 items-center justify-center rounded-full border text-sm font-semibold">
            {{ anyBarber ? '★' : initials(selectedBarber?.name) }}
          </div>
          <div>
            <p class="font-display text-2xl leading-none">{{ selectedService?.name }}</p>
            <p class="text-muted mt-1 text-xs">{{ anyBarber ? 'Cualquier barbero' : 'con ' + selectedBarber?.name }} · {{ studioName }}</p>
          </div>
        </div>

        <div class="border-default bg-muted rounded-2xl border px-4">
          <div class="border-default flex items-center gap-3 border-b py-3">
            <UIcon name="i-lucide-calendar" class="text-primary size-4" />
            <span class="text-muted flex-1 text-xs">Fecha</span>
            <span class="text-sm font-semibold capitalize">{{ fmtDate(selectedSlot!, "EEEE d 'de' MMMM") }}</span>
          </div>
          <div class="flex items-center gap-3 py-3">
            <UIcon name="i-lucide-clock" class="text-primary size-4" />
            <span class="text-muted flex-1 text-xs">Hora</span>
            <span class="text-sm font-semibold">{{ fmtDate(selectedSlot!, 'HH:mm') }}</span>
          </div>
        </div>

        <div class="border-default flex items-center justify-between border-t pt-3">
          <span class="text-sm font-semibold">Total</span>
          <span class="font-display text-2xl">{{ formatPrice(price) }}</span>
        </div>

        <div class="border-default flex gap-2.5 rounded-xl border border-dashed p-3.5">
          <UIcon name="i-lucide-lock" class="text-dimmed size-4 shrink-0" />
          <span class="text-dimmed text-xs leading-relaxed">Cancela gratis hasta {{ cancelHours }} h antes. Te recordaremos la cita el día anterior.</span>
        </div>
      </div>

      <!-- CTA por paso -->
      <div class="border-default bg-default sticky bottom-0 flex items-center gap-3 border-t px-5 py-3">
        <div v-if="step === 0">
          <p class="text-dimmed font-mono text-[0.6rem]">{{ selectedService ? formatDuration(duration) : 'Elige un servicio' }}</p>
          <p class="font-display text-xl">{{ formatPrice(price) }}</p>
        </div>
        <UButton v-if="step === 0" :disabled="!selectedService" color="primary" size="lg" class="flex-1 justify-center" trailing-icon="i-lucide-arrow-right" @click="goFecha">Elegir fecha</UButton>

        <template v-else-if="step === 1">
          <div>
            <p class="text-dimmed font-mono text-[0.6rem] uppercase">{{ selectedSlot ? fmtDate(selectedSlot, 'EEE d · HH:mm') : 'Elige hueco' }}</p>
            <p class="font-display text-xl">{{ formatPrice(price) }}</p>
          </div>
          <UButton :disabled="!selectedSlot" color="primary" size="lg" class="flex-1 justify-center" trailing-icon="i-lucide-arrow-right" @click="goConfirmar">Continuar</UButton>
        </template>

        <UButton v-else color="primary" size="lg" block :loading="submitting" icon="i-lucide-check" @click="confirm">Confirmar reserva</UButton>
      </div>
    </template>
  </div>

  <!-- ====================== ESCRITORIO ====================== -->
  <div class="mx-auto hidden w-full max-w-[1280px] flex-1 flex-col px-8 py-9 lg:flex">
    <!-- ÉXITO -->
    <div v-if="step === 'done'" class="relative flex flex-1 flex-col items-center justify-center text-center">
      <div class="bg-primary/15 border-primary/30 mb-7 flex size-24 items-center justify-center rounded-full border">
        <div class="bg-primary flex size-[68px] items-center justify-center rounded-full">
          <UIcon name="i-lucide-check" class="text-inverted size-9" />
        </div>
      </div>
      <h1 class="font-display text-5xl leading-none">¡Cita confirmada!</h1>
      <p class="text-muted mt-3.5 max-w-lg text-base leading-relaxed">
        Te esperamos el
        <span class="text-primary font-semibold">{{ fmtDate(selectedSlot!, "EEEE d 'a las' HH:mm") }}</span>.
        Hemos enviado los detalles a tu correo.
      </p>

      <div class="border-default bg-muted mt-8 flex w-full max-w-xl items-center gap-6 rounded-[18px] border px-7 py-6 text-left">
        <div class="border-primary/40 bg-elevated flex size-13 items-center justify-center rounded-full border text-base font-semibold">
          {{ initials(selectedBarber?.name) }}
        </div>
        <div class="flex-1">
          <p class="text-base font-semibold">{{ selectedService?.name }}</p>
          <p class="text-muted mt-0.5 text-sm">con {{ selectedBarber?.name }}</p>
        </div>
        <div class="flex gap-7">
          <div><p class="text-dimmed font-mono text-[0.55rem] tracking-wide">FECHA</p><p class="mt-1 text-sm font-semibold capitalize">{{ fmtDate(selectedSlot!, 'EEE d MMM') }}</p></div>
          <div><p class="text-dimmed font-mono text-[0.55rem] tracking-wide">HORA</p><p class="mt-1 text-sm font-semibold">{{ fmtDate(selectedSlot!, 'HH:mm') }}</p></div>
          <div><p class="text-dimmed font-mono text-[0.55rem] tracking-wide">CÓDIGO</p><p class="text-primary mt-1 font-mono text-sm font-semibold">{{ bookingCode }}</p></div>
        </div>
      </div>

      <div class="mt-7 flex justify-center gap-3">
        <UButton :to="gcalUrl" target="_blank" color="primary" size="lg" icon="i-lucide-calendar">Añadir al calendario</UButton>
        <UButton to="/app" color="neutral" variant="outline" size="lg">Volver al inicio</UButton>
      </div>
    </div>

    <!-- CONFIRMAR -->
    <template v-else-if="step === 2">
      <div class="mb-7 flex items-center justify-between">
        <h1 class="font-display text-4xl">Confirmar reserva</h1>
        <div class="flex items-center gap-3.5">
          <template v-for="(lab, i) in dLabels" :key="lab">
            <div class="flex items-center gap-2.5">
              <div
                class="flex size-7 items-center justify-center rounded-full border text-[0.8rem] font-bold"
                :class="i <= dStep ? 'bg-primary border-primary text-inverted' : 'border-default text-dimmed'"
              >
                <UIcon v-if="i < dStep" name="i-lucide-check" class="size-3.5" />
                <span v-else>{{ i + 1 }}</span>
              </div>
              <span class="text-sm" :class="i === dStep ? 'text-default font-bold' : 'text-dimmed font-medium'">{{ lab }}</span>
            </div>
            <span v-if="i < 2" class="bg-border h-px w-10" />
          </template>
        </div>
      </div>

      <div class="grid grid-cols-[1.4fr_1fr] items-start gap-6">
        <div class="space-y-5">
          <div class="border-default bg-muted rounded-2xl border p-6">
            <div class="border-default flex items-center gap-4 border-b pb-5">
              <div class="border-primary/40 bg-elevated flex size-13 items-center justify-center rounded-full border text-sm font-semibold">
                {{ anyBarber ? '★' : initials(selectedBarber?.name) }}
              </div>
              <div>
                <p class="font-display text-2xl leading-none">{{ selectedService?.name }}</p>
                <p class="text-muted mt-1.5 text-sm">{{ anyBarber ? 'Cualquier barbero' : 'con ' + selectedBarber?.name }} · {{ studioName }}</p>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-5 pt-5">
              <div class="flex items-center gap-3.5">
                <div class="bg-elevated flex size-10 items-center justify-center rounded-xl"><UIcon name="i-lucide-calendar" class="text-primary size-[18px]" /></div>
                <div><p class="text-dimmed text-xs">Fecha</p><p class="mt-0.5 text-sm font-semibold capitalize">{{ fmtDate(selectedSlot!, "EEEE d 'de' MMMM") }}</p></div>
              </div>
              <div class="flex items-center gap-3.5">
                <div class="bg-elevated flex size-10 items-center justify-center rounded-xl"><UIcon name="i-lucide-clock" class="text-primary size-[18px]" /></div>
                <div><p class="text-dimmed text-xs">Hora</p><p class="mt-0.5 text-sm font-semibold">{{ fmtDate(selectedSlot!, 'HH:mm') }}<span v-if="slotEnd"> – {{ fmtDate(slotEnd, 'HH:mm') }}</span></p></div>
              </div>
              <div class="flex items-center gap-3.5">
                <div class="bg-elevated flex size-10 items-center justify-center rounded-xl"><UIcon name="i-lucide-map-pin" class="text-primary size-[18px]" /></div>
                <div><p class="text-dimmed text-xs">Lugar</p><p class="mt-0.5 text-sm font-semibold">{{ studioPlace }}</p></div>
              </div>
              <div class="flex items-center gap-3.5">
                <div class="bg-elevated flex size-10 items-center justify-center rounded-xl"><UIcon name="i-lucide-scissors" class="text-primary size-[18px]" /></div>
                <div><p class="text-dimmed text-xs">Duración</p><p class="mt-0.5 text-sm font-semibold">{{ formatDuration(duration) }}</p></div>
              </div>
            </div>
          </div>

        </div>

        <div class="border-primary/30 bg-muted rounded-2xl border p-6">
          <p class="text-primary mb-4 font-mono text-[0.6rem] tracking-widest uppercase">Resumen</p>
          <div class="flex justify-between py-2 text-sm">
            <span class="text-muted">{{ selectedService?.name }}</span>
            <span class="font-medium">{{ formatPrice(price) }}</span>
          </div>
          <div class="flex justify-between py-2 text-sm">
            <span class="text-muted">Reserva online</span>
            <span class="text-success font-medium">Gratis</span>
          </div>
          <div class="border-default mt-2 flex items-baseline justify-between border-t pt-4">
            <span class="text-sm font-semibold">Total</span>
            <span class="font-display text-3xl">{{ formatPrice(price) }}</span>
          </div>
          <UButton class="mt-5 justify-center" color="primary" size="lg" block :loading="submitting" icon="i-lucide-check" @click="confirm">Confirmar reserva</UButton>
          <div class="border-default mt-3.5 flex gap-2.5 rounded-xl border border-dashed p-3.5">
            <UIcon name="i-lucide-lock" class="text-dimmed size-3.5 shrink-0" />
            <span class="text-dimmed text-[0.72rem] leading-relaxed">Cancela gratis hasta {{ cancelHours }} h antes. Te recordaremos la cita el día anterior.</span>
          </div>
          <button type="button" class="text-dimmed hover:text-default mt-3 w-full text-center text-xs" @click="step = 1">← Volver atrás</button>
        </div>
      </div>
    </template>

    <!-- RESERVAR (servicio + barbero + fecha + slots) -->
    <template v-else>
      <div class="mb-7 flex items-center justify-between">
        <h1 class="font-display text-4xl">Reservar cita</h1>
        <div class="flex items-center gap-3.5">
          <template v-for="(lab, i) in dLabels" :key="lab">
            <div class="flex items-center gap-2.5">
              <div
                class="flex size-7 items-center justify-center rounded-full border text-[0.8rem] font-bold"
                :class="i === dStep ? 'bg-primary border-primary text-inverted' : 'border-default text-dimmed'"
              >
                {{ i + 1 }}
              </div>
              <span class="text-sm" :class="i === dStep ? 'text-default font-bold' : 'text-dimmed font-medium'">{{ lab }}</span>
            </div>
            <span v-if="i < 2" class="bg-border h-px w-10" />
          </template>
        </div>
      </div>

      <div class="grid grid-cols-[1.5fr_1fr] items-start gap-6">
        <!-- izquierda: servicio + barbero + calendario -->
        <div class="space-y-7">
          <div>
            <h2 class="font-display mb-3.5 text-xl">1 · Elige servicio</h2>
            <div class="grid grid-cols-2 gap-3">
              <button
                v-for="s in publicServices"
                :key="s.id"
                type="button"
                class="flex items-center gap-3 rounded-xl border p-4 text-left"
                :class="selectedService?.id === s.id ? 'bg-primary/10 border-primary/30' : 'bg-muted border-default'"
                @click="pickService(s)"
              >
                <span
                  class="flex size-[22px] shrink-0 items-center justify-center rounded-full border"
                  :class="selectedService?.id === s.id ? 'bg-primary border-primary' : 'border-border'"
                >
                  <UIcon v-if="selectedService?.id === s.id" name="i-lucide-check" class="text-inverted size-3" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold">{{ s.name }}</p>
                  <p class="text-dimmed truncate text-xs">{{ formatDuration(s.durationMinutes) }}</p>
                </div>
                <span class="font-display text-xl">{{ formatPrice(s.basePrice) }}</span>
              </button>
            </div>
          </div>

          <div>
            <h2 class="font-display mb-3.5 text-xl">2 · Elige barbero</h2>
            <div class="flex flex-wrap gap-4">
              <button type="button" class="flex flex-col items-center gap-2" @click="anyBarber = true">
                <span
                  class="flex size-15 items-center justify-center rounded-full border"
                  :class="anyBarber ? 'border-primary bg-primary/15' : 'border-default bg-muted'"
                >
                  <UIcon name="i-lucide-sparkles" class="text-primary size-6" />
                </span>
                <span class="text-xs" :class="anyBarber ? 'text-default font-bold' : 'text-dimmed font-medium'">Cualquiera</span>
              </button>
              <button
                v-for="b in eligibleBarbers"
                :key="b.id"
                type="button"
                class="flex flex-col items-center gap-2"
                @click="anyBarber = false; selectedBarber = b"
              >
                <span class="rounded-full" :class="!anyBarber && selectedBarber?.id === b.id ? 'ring-primary ring-2 ring-offset-2 ring-offset-[var(--jdvm-bg-1)]' : ''">
                  <UiAvatar :name="b.name" :src="b.photoUrl || null" :size="60" :ring="b.color" />
                </span>
                <span class="text-xs" :class="!anyBarber && selectedBarber?.id === b.id ? 'text-default font-bold' : 'text-dimmed font-medium'">{{ b.name.split(' ')[0] }}</span>
              </button>
            </div>
          </div>

          <div>
            <div class="mb-3.5 flex items-center justify-between">
              <h2 class="font-display text-xl">3 · Elige fecha</h2>
              <div class="flex items-center gap-3">
                <button type="button" :disabled="!canPrevMonth" class="text-toned disabled:opacity-30" @click="shiftMonth(-1)"><UIcon name="i-lucide-chevron-left" class="size-[18px]" /></button>
                <span class="font-display text-base capitalize">{{ fmtDate(viewMonth, 'MMMM yyyy') }}</span>
                <button type="button" :disabled="!canNextMonth" class="text-toned disabled:opacity-30" @click="shiftMonth(1)"><UIcon name="i-lucide-chevron-right" class="size-[18px]" /></button>
              </div>
            </div>
            <div class="border-default bg-muted rounded-2xl border p-5">
              <div class="mb-2 grid grid-cols-7 gap-2">
                <div v-for="w in weekdayLabels" :key="w" class="text-dimmed pb-1 text-center font-mono text-[0.65rem]">{{ w }}</div>
              </div>
              <div class="grid grid-cols-7 gap-2">
                <template v-for="(d, i) in monthGrid" :key="i">
                  <div v-if="!d" />
                  <button
                    v-else
                    type="button"
                    :disabled="dayDisabled(d)"
                    class="relative flex aspect-square items-center justify-center rounded-[10px] text-sm transition-colors disabled:opacity-30"
                    :class="dayClass(d)"
                    @click="pickDay(d)"
                  >
                    {{ d.getDate() }}
                    <span
                      v-if="!dayDisabled(d) && !sameDay(d, selectedDate)"
                      class="absolute bottom-1.5 size-1 rounded-full"
                      :class="isDayFull(d) ? 'bg-error/70' : 'bg-primary/70'"
                    />
                  </button>
                </template>
              </div>
              <p v-if="selectedService" class="text-dimmed mt-2.5 flex items-center gap-1.5 text-[0.7rem]">
                <span class="bg-error/70 size-1.5 rounded-full" />Día completo (sin huecos)
              </p>
            </div>
          </div>
        </div>

        <!-- derecha: slots + resumen -->
        <div class="space-y-5">
          <div class="border-default bg-muted rounded-2xl border p-5">
            <div class="mb-4 flex items-center gap-2">
              <span class="font-display text-lg capitalize">{{ fmtDate(selectedDate, 'EEEE d') }}</span>
              <span class="flex-1" />
              <span class="text-dimmed font-mono text-[0.7rem]">{{ slots.length }} huecos</span>
            </div>
            <div v-if="!selectedService" class="text-dimmed py-6 text-center text-sm">Elige un servicio para ver los huecos.</div>
            <div v-else-if="slots.length" class="grid grid-cols-2 gap-2.5">
              <button
                v-for="s in slots"
                :key="s.toISOString()"
                type="button"
                class="rounded-xl border py-3 text-center"
                :class="selectedSlot?.getTime() === s.getTime() ? 'bg-primary border-primary' : 'bg-elevated border-default'"
                @click="selectedSlot = s"
              >
                <span class="font-mono text-[0.95rem] font-semibold" :class="selectedSlot?.getTime() === s.getTime() ? 'text-inverted' : 'text-default'">{{ fmtDate(s, 'HH:mm') }}</span>
              </button>
            </div>
            <p v-else class="text-dimmed py-6 text-center text-sm">No hay huecos ese día.</p>
          </div>

          <div class="border-primary/30 bg-muted rounded-2xl border p-5">
            <p class="text-primary mb-4 font-mono text-[0.6rem] tracking-widest uppercase">Tu reserva</p>
            <div class="border-default flex justify-between border-b py-2.5 text-sm">
              <span class="text-muted">Servicio</span><span class="font-semibold">{{ selectedService?.name ?? '—' }}</span>
            </div>
            <div class="border-default flex justify-between border-b py-2.5 text-sm">
              <span class="text-muted">Barbero</span><span class="font-semibold">{{ barberLabel }}</span>
            </div>
            <div class="border-default flex justify-between border-b py-2.5 text-sm">
              <span class="text-muted">Fecha</span><span class="font-semibold capitalize">{{ fmtDate(selectedDate, 'EEE d MMM') }}</span>
            </div>
            <div class="flex justify-between py-2.5 text-sm">
              <span class="text-muted">Hora</span><span class="font-semibold">{{ selectedSlot ? fmtDate(selectedSlot, 'HH:mm') : '—' }}</span>
            </div>
            <div class="border-default mt-1 flex items-baseline justify-between border-t pt-3.5">
              <span class="text-sm font-semibold">Total</span>
              <span class="font-display text-3xl">{{ formatPrice(price) }}</span>
            </div>
            <UButton class="mt-4 justify-center" color="primary" size="lg" block :disabled="!selectedService || !selectedSlot" trailing-icon="i-lucide-arrow-right" @click="goConfirmDesktop">Continuar</UButton>
          </div>

          <NuxtLink to="/lista-espera" class="border-default flex items-center gap-2.5 rounded-xl border border-dashed p-3.5">
            <UIcon name="i-lucide-bell" class="text-muted size-4" />
            <span class="text-muted text-xs">¿Sin tu hora ideal? <span class="text-primary font-semibold">Únete a la lista de espera</span></span>
          </NuxtLink>
        </div>
      </div>
    </template>
  </div>
  </div>
</template>
