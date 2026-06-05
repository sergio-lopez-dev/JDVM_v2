<script setup lang="ts">
import confetti from 'canvas-confetti'
import { effectivePrice, type Service, type Barber } from '~~/schemas'
import { generateSlots, resolveDayTimetable } from '~~/lib/slots'
import { toDate, weekdayOf } from '~~/lib/datetime'
import { fmtDate, formatPrice, formatDuration, initials } from '~~/lib/format'

definePageMeta({ layout: 'inner', middleware: 'auth' })
useHead({ title: 'Reservar · JDVM' })

const route = useRoute()
const user = useCurrentUser()
const toast = useToast()
const { publicServices } = useServices()
const { active: barbers } = useBarbers()
const { settings } = useSettings()
const { create } = useAppointments()

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

// Preselección de barbero por query (?barber=slug) desde el detalle.
watchEffect(() => {
  const slug = route.query.barber as string | undefined
  if (slug && barbers.value.length) {
    const b = barbers.value.find((x) => x.slug === slug)
    if (b) {
      selectedBarber.value = b
      anyBarber.value = false
    }
  }
})

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

const slots = computed(() => {
  const svc = selectedService.value
  if (!svc) return []
  const localTt = settings.value
    ? resolveDayTimetable(settings.value.timetable, selectedDate.value)
    : undefined
  const barberTt =
    selectedBarber.value && !anyBarber.value
      ? resolveDayTimetable(selectedBarber.value.timetable, selectedDate.value)
      : undefined
  return generateSlots({
    day: selectedDate.value,
    durationMinutes: svc.durationMinutes,
    localTimetable: localTt,
    barberTimetable: barberTt,
    busy: busy.value.map((a) => ({ start: toDate(a.startsAt), end: toDate(a.endsAt) })),
    stepMinutes: settings.value?.slotStepMinutes ?? 30,
  })
})

// Tira de 7 días desde hoy.
const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, i) => {
    const d = startOfToday()
    d.setDate(d.getDate() + i)
    return d
  }),
)
const isClosed = (d: Date) => settings.value?.daysClosed?.includes(weekdayOf(d)) ?? false

const price = computed(() =>
  selectedService.value
    ? effectivePrice(selectedService.value, selectedBarberId.value ?? undefined)
    : 0,
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
  submitting.value = true
  try {
    let barber = anyBarber.value ? null : selectedBarber.value
    if (!barber) barber = eligibleBarbers.value[0] ?? barbers.value[0] ?? null
    if (!barber) throw new Error('No hay barberos disponibles.')
    const endsAt = new Date(slot.getTime() + svc.durationMinutes * 60_000)
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
    bookingCode.value = `JDVM-${ref.id.slice(-4).toUpperCase()}`
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
</script>

<template>
  <div class="flex flex-1 flex-col">
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
            <p class="text-dimmed font-mono text-[0.65rem]">{{ formatDuration(selectedService?.durationMinutes) }} · {{ formatPrice(price) }}</p>
          </div>
          <button type="button" class="text-primary text-xs font-semibold" @click="step = 0">Cambiar</button>
        </div>

        <!-- barbero -->
        <div>
          <div class="mb-3 flex items-center justify-between">
            <div>
              <p class="text-sm font-semibold">Barbero concreto</p>
              <p class="text-dimmed text-xs">{{ anyBarber ? 'Ahora: cualquiera disponible' : selectedBarber?.name }}</p>
            </div>
            <USwitch :model-value="!anyBarber" @update:model-value="anyBarber = !$event" />
          </div>
          <div v-if="!anyBarber" class="flex gap-3 overflow-x-auto pb-1">
            <button
              v-for="b in eligibleBarbers"
              :key="b.id"
              type="button"
              class="flex shrink-0 flex-col items-center gap-1.5"
              @click="selectedBarber = b"
            >
              <span
                class="flex size-12 items-center justify-center rounded-full border text-sm font-semibold"
                :class="selectedBarber?.id === b.id ? 'border-primary bg-primary/15 text-primary' : 'border-default bg-elevated text-muted'"
              >{{ initials(b.name) }}</span>
              <span class="text-[0.7rem]" :class="selectedBarber?.id === b.id ? 'text-default font-semibold' : 'text-dimmed'">{{ b.name.split(' ')[0] }}</span>
            </button>
          </div>
        </div>

        <!-- semana -->
        <div class="grid grid-cols-7 gap-1.5">
          <button
            v-for="d in weekDays"
            :key="d.toISOString()"
            type="button"
            :disabled="isClosed(d)"
            class="flex flex-col items-center gap-1.5 rounded-xl border py-2 disabled:opacity-40"
            :class="d.getTime() === selectedDate.getTime() ? 'bg-primary border-primary text-inverted' : 'bg-muted border-default'"
            @click="pickDay(d)"
          >
            <span class="font-mono text-[0.6rem] uppercase">{{ fmtDate(d, 'EEEEE') }}</span>
            <span class="font-display text-lg leading-none">{{ fmtDate(d, 'd') }}</span>
          </button>
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
            <p class="text-muted mt-1 text-xs">{{ anyBarber ? 'Cualquier barbero' : 'con ' + selectedBarber?.name }} · JDVM Maracena</p>
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

        <div>
          <p class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">Método de pago</p>
          <div class="space-y-2.5">
            <button
              v-for="p in [{ k: 'cash', label: 'Pagar en el local', icon: 'i-lucide-store' }, { k: 'revolut', label: 'Revolut (QR)', icon: 'i-lucide-qr-code' }]"
              :key="p.k"
              type="button"
              class="flex w-full items-center gap-3 rounded-xl border p-3.5"
              :class="paymentMethod === p.k ? 'bg-primary/10 border-primary/30' : 'bg-muted border-default'"
              @click="paymentMethod = p.k as 'cash' | 'revolut'"
            >
              <UIcon :name="p.icon" class="size-4" :class="paymentMethod === p.k ? 'text-primary' : 'text-muted'" />
              <span class="flex-1 text-left text-sm font-semibold">{{ p.label }}</span>
              <span class="flex size-4 items-center justify-center rounded-full border" :class="paymentMethod === p.k ? 'border-primary bg-primary' : 'border-border'">
                <span v-if="paymentMethod === p.k" class="bg-inverted size-1.5 rounded-full" />
              </span>
            </button>
          </div>
        </div>

        <div class="border-default flex items-center justify-between border-t pt-3">
          <span class="text-sm font-semibold">Total</span>
          <span class="font-display text-2xl">{{ formatPrice(price) }}</span>
        </div>

        <div class="border-default flex gap-2.5 rounded-xl border border-dashed p-3.5">
          <UIcon name="i-lucide-lock" class="text-dimmed size-4 shrink-0" />
          <span class="text-dimmed text-xs leading-relaxed">Cancela gratis hasta 4 h antes. Te recordaremos la cita el día anterior.</span>
        </div>
      </div>

      <!-- CTA por paso -->
      <div class="border-default bg-default sticky bottom-0 flex items-center gap-3 border-t px-5 py-3">
        <div v-if="step === 0">
          <p class="text-dimmed font-mono text-[0.6rem]">{{ selectedService ? formatDuration(selectedService.durationMinutes) : 'Elige un servicio' }}</p>
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
</template>
