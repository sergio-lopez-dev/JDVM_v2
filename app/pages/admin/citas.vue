<script setup lang="ts">
import { fmtDate, formatPrice, initials } from '~~/lib/format'
import { sameDay } from '~~/lib/datetime'
import type { AdminAppointment } from '~/composables/useAdminAppointments'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Citas · Admin' })

const { inRange, setStatus, cancel, remove } = useAppointments()
const { notifyCancellation } = useNotifications()
const { setBanned, clientById } = useClients()
const toast = useToast()

function startOfToday() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
const rangeStart = computed(() => {
  const d = startOfToday()
  d.setDate(d.getDate() - 7)
  return d
})
const rangeEnd = computed(() => {
  const d = startOfToday()
  d.setDate(d.getDate() + 31)
  return d
})
const raw = inRange(rangeStart, rangeEnd)
const { enriched } = useAdminAppointments(raw)

const search = ref('')
const FILTERS = ['Todas', 'Hoy', 'Confirmadas', 'Hechas', 'No vino', 'Canceladas'] as const
const filter = ref<(typeof FILTERS)[number]>('Todas')

const today = startOfToday()
const tomorrow = (() => {
  const d = startOfToday()
  d.setDate(d.getDate() + 1)
  return d
})()

function dayLabel(d: Date) {
  if (sameDay(d, today)) return 'Hoy'
  if (sameDay(d, tomorrow)) return 'Mañana'
  return fmtDate(d, 'd MMM')
}
type PillKind = 'confirmed' | 'done' | 'pending' | 'cancelled' | 'neutral'
function statusKind(s: string): PillKind {
  return s === 'completed'
    ? 'done'
    : s === 'cancelled'
      ? 'cancelled'
      : s === 'no_show'
        ? 'neutral'
        : 'confirmed'
}
function statusLabel(s: string) {
  return s === 'completed'
    ? 'Hecha'
    : s === 'cancelled'
      ? 'Cancelada'
      : s === 'no_show'
        ? 'No vino'
        : 'Confirmada'
}

const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return enriched.value
    .filter((a) => {
      if (filter.value === 'Hoy') return sameDay(a.startsAt, today)
      if (filter.value === 'Confirmadas') return a.status === 'booked'
      if (filter.value === 'Hechas') return a.status === 'completed'
      if (filter.value === 'No vino') return a.status === 'no_show'
      if (filter.value === 'Canceladas') return a.status === 'cancelled'
      return true
    })
    .filter((a) =>
      !q
        ? true
        : a.clientName.toLowerCase().includes(q) ||
          a.serviceName.toLowerCase().includes(q) ||
          a.barberName.toLowerCase().includes(q),
    )
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
})

// Paginación.
const page = ref(1)
const perPage = 12
watch([filter, search], () => (page.value = 1))
const pages = computed(() => Math.max(1, Math.ceil(filtered.value.length / perPage)))
const pageRows = computed(() =>
  filtered.value.slice((page.value - 1) * perPage, page.value * perPage),
)

// Acciones sobre una cita.
const selected = ref<AdminAppointment | null>(null)

// Veto del cliente (para ofrecer vetar tras un "no vino").
const selectedClientId = computed(() => selected.value?.clientId ?? null)
const selectedClientDoc = clientById(selectedClientId)
const selectedBanned = computed(() => !!selectedClientDoc.value?.banned)
const banPrompt = ref(false)
const banBusy = ref(false)
watch(
  () => selected.value?.id,
  () => (banPrompt.value = false),
)

async function noShowSel() {
  if (!selected.value) return
  const id = selected.value.id
  try {
    await setStatus(id, 'no_show')
    toast.add({ title: 'Marcada como “no vino”', icon: 'i-lucide-user-x', color: 'warning' })
    if (selected.value?.id === id) selected.value = { ...selected.value, status: 'no_show' }
    // Ofrece vetar solo a clientes registrados (un walk-in manual no tiene cuenta).
    if (selected.value?.clientId && !selectedBanned.value) banPrompt.value = true
  } catch (e) {
    toast.add({ title: 'Error', description: (e as Error).message, color: 'error' })
  }
}
async function banFromPrompt() {
  if (!selected.value?.clientId || banBusy.value) return
  banBusy.value = true
  try {
    await setBanned(selected.value.clientId, true)
    toast.add({
      title: 'Cliente vetado',
      description: 'No podrá coger nuevas citas.',
      icon: 'i-lucide-ban',
      color: 'warning',
    })
    banPrompt.value = false
  } catch (e) {
    toast.add({ title: 'No se pudo vetar', description: (e as Error).message, color: 'error' })
  } finally {
    banBusy.value = false
  }
}
// Deshace "no vino" o "hecha": la cita vuelve a 'booked' (confirmada).
async function revertToBooked() {
  if (!selected.value) return
  const id = selected.value.id
  await setStatus(id, 'booked')
  toast.add({
    title: 'Cita reactivada',
    description: 'Vuelve a “confirmada”.',
    icon: 'i-lucide-undo-2',
    color: 'success',
  })
  if (selected.value?.id === id) selected.value = { ...selected.value, status: 'booked' }
  banPrompt.value = false
}

async function cancelSel() {
  if (!selected.value) return
  const s = selected.value
  await cancel(s.id, s.startsAt, { isAdmin: true })
  await notifyCancellation({
    barberId: s.barberId,
    clientName: s.clientName,
    serviceName: s.serviceName,
    when: fmtDate(s.startsAt, "EEE d MMM 'a las' HH:mm"),
    appointmentId: s.id,
  })
}

// Completar: por defecto se cobra en efectivo; el drawer queda abierto reflejando el
// estado para poder cambiar a tarjeta sin reabrir.
async function markCompleted() {
  if (!selected.value) return
  const id = selected.value.id
  const pay = selected.value.paymentMethod === 'card' ? 'card' : 'cash'
  try {
    await setStatus(id, 'completed', { paymentMethod: pay })
    toast.add({ title: 'Cita completada', icon: 'i-lucide-check', color: 'success' })
    if (selected.value?.id === id)
      selected.value = { ...selected.value, status: 'completed', paymentMethod: pay }
  } catch (e) {
    toast.add({ title: 'Error', description: (e as Error).message, color: 'error' })
  }
}

// Cambió el servicio de la cita: refleja precio/duración/fin en el drawer (snapshot).
function onServiceChanged(p: {
  serviceId: string
  price: number
  endsAt: Date
  serviceName: string
  serviceDuration: number
}) {
  if (!selected.value) return
  selected.value = { ...selected.value, ...p }
}

async function act(fn: () => Promise<unknown>, msg: string) {
  try {
    await fn()
    toast.add({ title: msg, icon: 'i-lucide-check', color: 'success' })
    selected.value = null
  } catch (e) {
    toast.add({ title: 'Error', description: (e as Error).message, color: 'error' })
  }
}

const bookingOpen = ref(false)
</script>

<template>
  <div>
    <AdminHeader
      v-model:search="search"
      title="Citas"
      sub="Gestiona y revisa todas las reservas"
      show-search
      search-placeholder="Buscar cliente, servicio…"
    >
      <template #actions>
        <UButton color="primary" icon="i-lucide-plus" @click="bookingOpen = true"
          >Nueva cita</UButton
        >
      </template>
    </AdminHeader>

    <div class="space-y-4 px-5 py-6 pb-24 lg:px-7 lg:pb-6">
      <!-- buscador (en móvil: aquí; en ≥sm va en la cabecera) -->
      <UInput
        v-model="search"
        placeholder="Buscar cliente, servicio…"
        icon="i-lucide-search"
        class="w-full sm:hidden"
      />

      <!-- filtros (scroll horizontal en móvil para no desbordar) -->
      <div class="flex flex-wrap items-center gap-3">
        <div class="-mx-1 max-w-full overflow-x-auto px-1">
          <div class="border-default bg-muted inline-flex rounded-[10px] border p-1">
            <button
              v-for="f in FILTERS"
              :key="f"
              type="button"
              class="shrink-0 rounded-[7px] px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors"
              :class="
                filter === f
                  ? 'bg-primary text-inverted font-semibold'
                  : 'text-toned hover:text-default font-medium'
              "
              @click="filter = f"
            >
              {{ f }}
            </button>
          </div>
        </div>
        <span class="text-dimmed ml-auto text-xs">{{ filtered.length }} citas</span>
      </div>

      <!-- móvil: tarjetas -->
      <div class="space-y-2.5 lg:hidden">
        <button
          v-for="a in pageRows"
          :key="a.id"
          type="button"
          class="border-default bg-muted w-full rounded-2xl border p-3.5 text-left"
          @click="selected = a"
        >
          <div class="flex items-center gap-3">
            <span
              class="bg-elevated border-default flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold"
              >{{ initials(a.clientName) }}</span
            >
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold">{{ a.clientName }}</div>
              <div class="text-dimmed truncate text-xs">{{ a.serviceName }}</div>
            </div>
            <AdminPill :kind="statusKind(a.status)">{{ statusLabel(a.status) }}</AdminPill>
          </div>
          <div class="border-default mt-3 flex items-center gap-4 border-t pt-3">
            <span class="text-toned flex items-center gap-1.5 font-mono text-xs"
              ><UIcon name="i-lucide-clock" class="text-dimmed size-3.5" />{{
                fmtDate(a.startsAt, 'HH:mm')
              }}
              · {{ dayLabel(a.startsAt) }}</span
            >
            <span class="text-toned flex items-center gap-1.5 text-xs"
              ><UIcon name="i-lucide-user" class="text-dimmed size-3.5" />{{ a.barberName }}</span
            >
            <span class="font-display ml-auto text-lg">{{ formatPrice(a.price) }}</span>
          </div>
        </button>
        <div v-if="!filtered.length" class="border-default rounded-2xl border p-8">
          <UiEmptyState
            icon="i-lucide-calendar-x"
            title="Sin citas"
            description="No hay citas que coincidan."
          />
        </div>
      </div>

      <!-- escritorio: tabla -->
      <AdminCard :pad="false" class="hidden lg:block">
        <div class="overflow-x-auto">
          <div class="min-w-[760px]">
            <div
              class="bg-accented border-default text-dimmed grid grid-cols-[110px_2fr_1.4fr_1.4fr_80px_120px_40px] gap-3 border-b px-5 py-3 font-mono text-[0.6rem] tracking-widest uppercase"
            >
              <span>Hora</span><span>Cliente</span><span>Servicio</span><span>Barbero</span
              ><span>Precio</span><span>Estado</span><span />
            </div>
            <button
              v-for="a in pageRows"
              :key="a.id"
              type="button"
              class="border-default hover:bg-elevated grid w-full grid-cols-[110px_2fr_1.4fr_1.4fr_80px_120px_40px] items-center gap-3 border-b px-5 py-3 text-left last:border-b-0"
              @click="selected = a"
            >
              <div>
                <div class="font-mono text-sm font-semibold">
                  {{ fmtDate(a.startsAt, 'HH:mm') }}
                </div>
                <div class="text-dimmed text-[0.7rem]">{{ dayLabel(a.startsAt) }}</div>
              </div>
              <div class="flex min-w-0 items-center gap-3">
                <span
                  class="bg-elevated border-default flex size-8 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold"
                  >{{ initials(a.clientName) }}</span
                >
                <span class="truncate text-sm font-semibold">{{ a.clientName }}</span>
              </div>
              <span class="text-toned truncate text-sm">{{ a.serviceName }}</span>
              <span class="text-toned truncate text-sm">{{ a.barberName }}</span>
              <span class="font-display text-lg">{{ formatPrice(a.price) }}</span>
              <AdminPill :kind="statusKind(a.status)">{{ statusLabel(a.status) }}</AdminPill>
              <UIcon name="i-lucide-ellipsis" class="text-dimmed size-[18px] justify-self-end" />
            </button>
            <div v-if="!filtered.length" class="p-10">
              <UiEmptyState
                icon="i-lucide-calendar-x"
                title="Sin citas"
                description="No hay citas que coincidan con el filtro."
              />
            </div>
          </div>
        </div>
      </AdminCard>

      <!-- paginación (compartida) -->
      <div v-if="filtered.length" class="flex items-center justify-between">
        <span class="text-dimmed text-xs"
          >Mostrando {{ pageRows.length }} de {{ filtered.length }} citas</span
        >
        <div class="flex items-center gap-1.5">
          <button
            type="button"
            aria-label="Anterior"
            class="border-default bg-muted hover:bg-elevated flex size-9 items-center justify-center rounded-[10px] border disabled:opacity-40"
            :disabled="page <= 1"
            @click="page--"
          >
            <UIcon name="i-lucide-chevron-left" class="size-4" />
          </button>
          <span class="text-toned px-2 font-mono text-sm">{{ page }} / {{ pages }}</span>
          <button
            type="button"
            aria-label="Siguiente"
            class="border-default bg-muted hover:bg-elevated flex size-9 items-center justify-center rounded-[10px] border disabled:opacity-40"
            :disabled="page >= pages"
            @click="page++"
          >
            <UIcon name="i-lucide-chevron-right" class="size-4" />
          </button>
        </div>
      </div>
    </div>

    <AdminFab label="Nueva cita" @click="bookingOpen = true" />

    <!-- acciones de cita -->
    <Transition
      enter-active-class="transition-opacity"
      leave-active-class="transition-opacity"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="selected"
        class="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
        @click="selected = null"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div
          class="border-default bg-default relative w-full max-w-md overflow-hidden rounded-t-3xl border p-5 sm:rounded-3xl"
          @click.stop
        >
          <div class="flex items-start justify-between">
            <div>
              <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase capitalize">
                {{ fmtDate(selected.startsAt, 'EEE d MMM · HH:mm') }}
              </p>
              <h2 class="font-display mt-1 text-2xl">{{ selected.clientName }}</h2>
              <p class="text-muted mt-0.5 text-sm">
                {{ selected.serviceName }} · {{ selected.barberName }}
              </p>
            </div>
            <span class="font-display text-2xl">{{ formatPrice(selected.price) }}</span>
          </div>

          <!-- cambiar el servicio realizado -->
          <ApptServiceEditor
            v-if="selected.status !== 'cancelled'"
            class="mt-4"
            :appointment-id="selected.id"
            :barber-id="selected.barberId"
            :service-id="selected.serviceId"
            :starts-at="selected.startsAt"
            @changed="onServiceChanged"
          />

          <!-- cobro: efectivo / tarjeta (cita ya cobrada) -->
          <div
            v-if="selected.status === 'completed'"
            class="mt-4 flex items-center justify-between gap-3"
          >
            <span class="flex items-center gap-2 text-sm font-semibold"
              ><UIcon name="i-lucide-wallet" class="text-primary size-4" />Cobrado en</span
            >
            <PaymentToggle :id="selected.id" :method="selected.paymentMethod" />
          </div>

          <!-- propina (100% para el barbero; cuenta en sus ingresos) -->
          <TipEditor
            v-if="selected.status === 'completed' && selected.type !== 'block'"
            :id="selected.id"
            :tip="selected.tip"
            class="mt-3"
            @changed="(t) => selected && (selected = { ...selected, tip: t })"
          />

          <div class="mt-5 grid grid-cols-2 gap-2.5">
            <UButton
              v-if="selected.status === 'booked'"
              color="success"
              variant="soft"
              block
              icon="i-lucide-check"
              @click="markCompleted"
              >Completar</UButton
            >
            <UButton
              v-if="selected.status === 'booked'"
              color="neutral"
              variant="soft"
              block
              icon="i-lucide-user-x"
              @click="noShowSel"
              >No vino</UButton
            >
            <UButton
              v-if="selected.status === 'booked'"
              color="warning"
              variant="soft"
              block
              icon="i-lucide-calendar-x"
              @click="act(() => cancelSel(), 'Cita cancelada')"
              >Cancelar</UButton
            >
            <UButton
              v-if="selected.status === 'no_show'"
              color="neutral"
              variant="soft"
              block
              icon="i-lucide-undo-2"
              @click="revertToBooked"
              >Deshacer “no vino”</UButton
            >
            <UButton
              v-if="selected.status === 'completed'"
              color="neutral"
              variant="soft"
              block
              icon="i-lucide-undo-2"
              @click="revertToBooked"
              >Deshacer “hecha”</UButton
            >
            <UButton
              color="error"
              variant="soft"
              block
              icon="i-lucide-trash-2"
              @click="act(() => remove(selected!.id), 'Cita eliminada')"
              >Eliminar</UButton
            >
          </div>

          <!-- ofrecer veto tras marcar "no vino" -->
          <div v-if="banPrompt" class="border-warning/40 bg-warning/10 mt-4 rounded-2xl border p-4">
            <p class="text-sm font-medium">
              El cliente no se presentó. ¿Vetarlo para que no coja más citas hasta que pague la cita
              perdida?
            </p>
            <div class="mt-3 flex gap-2.5">
              <UButton
                color="error"
                class="flex-1 justify-center"
                icon="i-lucide-ban"
                :loading="banBusy"
                @click="banFromPrompt"
                >Vetar cliente</UButton
              >
              <UButton
                color="neutral"
                variant="soft"
                class="flex-1 justify-center"
                @click="banPrompt = false"
                >Ahora no</UButton
              >
            </div>
          </div>
          <p
            v-else-if="selectedBanned"
            class="text-error mt-3 flex items-center justify-center gap-1.5 text-xs"
          >
            <UIcon name="i-lucide-ban" class="size-3.5" />Cliente vetado.
          </p>
        </div>
      </div>
    </Transition>

    <AdminBookingModal v-model:open="bookingOpen" />
  </div>
</template>
