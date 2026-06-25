<script setup lang="ts">
import { fmtDate, formatPrice, formatDuration, initials } from '~~/lib/format'
import { waLink, telLink } from '~~/lib/phone'
import { PAYMENT_METHOD_LABELS } from '~~/schemas'

definePageMeta({ layout: 'barber', middleware: 'barber' })
useHead({ title: 'Cita · Barbero' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { setStatus, remove } = useAppointments()
const { enriched } = useBarber()
const { setBanned, clientById } = useClients()

const id = computed(() => route.params.id as string)
const appt = computed(() => enriched.value.find((a) => a.id === id.value) ?? null)

// Un bloqueo (type 'block') no es una cita: solo se puede quitar (liberar el hueco).
const isBlock = computed(() => appt.value?.type === 'block')
async function removeBlock() {
  if (!appt.value || !confirm('¿Quitar este bloqueo? El hueco vuelve a quedar disponible.')) return
  await remove(appt.value.id)
  toast.add({ title: 'Bloqueo quitado', icon: 'i-lucide-lock-open', color: 'success' })
  router.back()
}

// Estado de veto del cliente de esta cita (lo puede cambiar el barbero).
const clientUid = computed(() => appt.value?.clientId ?? null)
const clientDoc = clientById(clientUid)
const banned = computed(() => !!clientDoc.value?.banned)
const banBusy = ref(false)

const PAY = PAYMENT_METHOD_LABELS

// Visitas anteriores del mismo cliente con este barbero (solo si está registrado:
// los walk-in manuales comparten clientId '' y no se pueden agrupar con fiabilidad).
const visits = computed(() =>
  appt.value?.clientId ? enriched.value.filter((a) => a.clientId === appt.value!.clientId) : [],
)
const history = computed(() =>
  visits.value
    .filter(
      (a) => a.id !== id.value && (a.status === 'completed' || a.startsAt.getTime() < Date.now()),
    )
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .slice(0, 5),
)

async function markDone() {
  if (!appt.value) return
  // Al cobrar, el método por defecto es efectivo (se puede cambiar a tarjeta luego).
  await setStatus(appt.value.id, 'completed', {
    paymentMethod: appt.value.paymentMethod === 'card' ? 'card' : 'cash',
  })
  toast.add({ title: 'Cita marcada como hecha', icon: 'i-lucide-check', color: 'success' })
}
const banPrompt = ref(false)
async function markNoShow() {
  if (!appt.value) return
  // No cuenta en la contabilidad (solo suman las 'completed').
  await setStatus(appt.value.id, 'no_show')
  toast.add({ title: 'Marcada como “no vino”', icon: 'i-lucide-user-x', color: 'warning' })
  // Ofrece vetar (no siempre se veta: solo si no paga la cita perdida). Solo a
  // clientes registrados (un walk-in manual no tiene cuenta que vetar).
  if (clientUid.value && !banned.value) banPrompt.value = true
}
async function banFromPrompt() {
  await toggleBan()
  banPrompt.value = false
}
// Deshace "no vino" o "hecha": la cita vuelve a 'booked' (confirmada).
async function revertToBooked() {
  if (!appt.value) return
  await setStatus(appt.value.id, 'booked')
  toast.add({
    title: 'Cita reactivada',
    description: 'Vuelve a “confirmada”.',
    icon: 'i-lucide-undo-2',
    color: 'success',
  })
  banPrompt.value = false
}
async function toggleBan() {
  if (!clientUid.value || banBusy.value) return
  banBusy.value = true
  try {
    await setBanned(clientUid.value, !banned.value)
    toast.add({
      title: banned.value ? 'Veto retirado' : 'Cliente vetado',
      description: banned.value
        ? 'Ya puede reservar de nuevo.'
        : 'No podrá coger nuevas citas hasta que lo readmitas.',
      icon: banned.value ? 'i-lucide-user-check' : 'i-lucide-ban',
      color: banned.value ? 'success' : 'warning',
    })
  } catch (e) {
    toast.add({ title: 'No se pudo actualizar', description: (e as Error).message, color: 'error' })
  } finally {
    banBusy.value = false
  }
}
function reschedule() {
  toast.add({
    title: 'Reprogramar',
    description: 'Pídeselo al administrador del local.',
    icon: 'i-lucide-calendar-clock',
  })
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-1 flex-col">
    <header class="flex items-center justify-between px-4 pt-4 pb-2 lg:px-0 lg:pt-6">
      <button
        type="button"
        aria-label="Volver"
        class="border-default bg-muted flex size-10 items-center justify-center rounded-xl border"
        @click="router.back()"
      >
        <UIcon name="i-lucide-chevron-left" class="size-5" />
      </button>
      <span class="font-display text-lg">Cita</span>
      <div class="size-10" />
    </header>

    <!-- bloqueo de hueco: vista mínima (solo quitar) -->
    <div
      v-if="appt && isBlock"
      class="flex flex-1 flex-col items-center justify-center px-8 text-center"
    >
      <div
        class="border-default bg-muted mb-5 flex size-16 items-center justify-center rounded-full border"
      >
        <UIcon name="i-lucide-lock" class="text-dimmed size-7" />
      </div>
      <h1 class="font-display text-3xl">Hueco bloqueado</h1>
      <p class="text-toned mt-2 text-sm">
        {{ fmtDate(appt.startsAt, "EEEE d 'de' MMMM") }} · {{ fmtDate(appt.startsAt, 'HH:mm') }}–{{
          fmtDate(appt.endsAt, 'HH:mm')
        }}
      </p>
      <p v-if="appt.note" class="text-dimmed mt-1 text-sm">{{ appt.note }}</p>
      <UButton
        color="error"
        variant="soft"
        size="lg"
        class="mt-6"
        icon="i-lucide-lock-open"
        @click="removeBlock"
        >Quitar bloqueo</UButton
      >
    </div>

    <template v-else-if="appt">
      <div class="flex-1 space-y-5 overflow-y-auto px-5 pt-2 pb-28">
        <!-- cliente -->
        <div class="text-center">
          <div
            class="border-primary/40 bg-elevated mx-auto flex size-16 items-center justify-center rounded-full border text-lg font-semibold"
          >
            {{ initials(appt.clientName) }}
          </div>
          <h1 class="font-display mt-3 text-3xl leading-none">{{ appt.clientName }}</h1>
          <div class="text-toned mt-2 flex items-center justify-center gap-2.5 text-xs">
            <span>{{ visits.length >= 3 ? 'Cliente habitual' : 'Cliente' }}</span>
            <span class="bg-dimmed size-0.5 rounded-full" style="background: var(--jdvm-fg-2)" />
            <span class="flex items-center gap-1"
              ><UIcon name="i-lucide-star" class="text-primary size-3" />{{
                visits.length
              }}
              visitas</span
            >
          </div>
        </div>

        <!-- datos -->
        <div class="border-default bg-muted rounded-2xl border px-4">
          <div class="border-default flex items-center gap-3 border-b py-3.5">
            <div class="bg-accented flex size-9 items-center justify-center rounded-[10px]">
              <UIcon name="i-lucide-scissors" class="text-primary size-4" />
            </div>
            <div class="flex-1">
              <div class="text-dimmed text-[0.7rem]">Servicio</div>
              <div class="text-sm font-semibold">
                {{ appt.serviceName }} · {{ formatDuration(appt.serviceDuration) }}
              </div>
            </div>
          </div>
          <div class="border-default flex items-center gap-3 border-b py-3.5">
            <div class="bg-accented flex size-9 items-center justify-center rounded-[10px]">
              <UIcon name="i-lucide-clock" class="text-primary size-4" />
            </div>
            <div class="flex-1">
              <div class="text-dimmed text-[0.7rem]">Hora</div>
              <div class="text-sm font-semibold capitalize">
                {{ fmtDate(appt.startsAt, 'EEE d') }} · {{ fmtDate(appt.startsAt, 'HH:mm') }}–{{
                  fmtDate(appt.endsAt, 'HH:mm')
                }}
              </div>
            </div>
          </div>
          <div class="flex items-center gap-3 py-3.5">
            <div class="bg-accented flex size-9 items-center justify-center rounded-[10px]">
              <UIcon name="i-lucide-euro" class="text-primary size-4" />
            </div>
            <div class="flex-1">
              <div class="text-dimmed text-[0.7rem]">Importe</div>
              <div class="text-sm font-semibold">
                {{ formatPrice(appt.price)
                }}<span v-if="appt.paymentMethod"> · {{ PAY[appt.paymentMethod] }}</span>
              </div>
            </div>
            <AdminPill :kind="appt.status === 'completed' ? 'done' : 'pending'">{{
              appt.status === 'completed' ? 'Pagado' : 'Pendiente'
            }}</AdminPill>
          </div>
        </div>

        <!-- cambiar el servicio realizado (recalcula precio y fin) -->
        <ApptServiceEditor
          v-if="appt.status !== 'cancelled'"
          :appointment-id="appt.id"
          :barber-id="appt.barberId"
          :service-id="appt.serviceId"
          :starts-at="appt.startsAt"
        />

        <!-- cobro: efectivo / tarjeta (solo cuando la cita ya está cobrada) -->
        <div
          v-if="appt.status === 'completed'"
          class="border-default bg-muted flex items-center justify-between gap-3 rounded-2xl border p-4"
        >
          <div class="flex items-center gap-2 text-sm font-semibold">
            <UIcon name="i-lucide-wallet" class="text-primary size-4" />Cobrado en
          </div>
          <PaymentToggle :id="appt.id" :method="appt.paymentMethod" />
        </div>

        <!-- propina (100% para ti; cuenta en Mis ingresos) -->
        <TipEditor v-if="appt.status === 'completed'" :id="appt.id" :tip="appt.tip" />

        <!-- contacto: WhatsApp / llamar -->
        <div v-if="appt.clientPhone" class="grid grid-cols-2 gap-2.5">
          <a
            :href="waLink(appt.clientPhone)"
            target="_blank"
            rel="noopener"
            class="flex items-center justify-center gap-2 rounded-2xl border border-[#25D366]/40 bg-[#25D366]/10 p-4 text-sm font-semibold text-[#25D366] transition hover:bg-[#25D366]/20"
          >
            <UIcon name="i-lucide-message-circle" class="size-5" />WhatsApp
          </a>
          <a
            :href="telLink(appt.clientPhone)"
            class="border-default bg-muted text-toned hover:bg-elevated flex items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition"
          >
            <UIcon name="i-lucide-phone" class="size-5" />Llamar
          </a>
        </div>

        <!-- acciones sobre el cliente / la cita (barbero) -->
        <div class="grid grid-cols-2 gap-2.5">
          <UButton
            v-if="appt.status === 'booked'"
            color="warning"
            variant="soft"
            size="lg"
            class="justify-center"
            :class="!clientUid ? 'col-span-2' : ''"
            icon="i-lucide-user-x"
            @click="markNoShow"
            >No vino</UButton
          >
          <UButton
            v-if="clientUid"
            :color="banned ? 'success' : 'error'"
            variant="soft"
            size="lg"
            class="justify-center"
            :class="appt.status !== 'booked' ? 'col-span-2' : ''"
            :icon="banned ? 'i-lucide-user-check' : 'i-lucide-ban'"
            :loading="banBusy"
            @click="toggleBan"
            >{{ banned ? 'Quitar veto' : 'Vetar cliente' }}</UButton
          >
        </div>
        <p v-if="banned" class="text-error -mt-2 flex items-center gap-1.5 text-xs">
          <UIcon name="i-lucide-ban" class="size-3.5" />Cliente vetado: no puede coger nuevas citas.
        </p>

        <!-- ofrecer veto tras marcar "no vino" -->
        <div v-if="banPrompt" class="border-warning/40 bg-warning/10 rounded-2xl border p-4">
          <p class="text-sm font-medium">
            El cliente no se presentó. ¿Quieres vetarlo para que no coja más citas hasta que pague
            la cita perdida?
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

        <!-- últimas visitas -->
        <div v-if="history.length">
          <p class="text-dimmed mb-2.5 font-mono text-[0.6rem] tracking-[0.15em] uppercase">
            Últimas visitas
          </p>
          <div class="space-y-2">
            <div
              v-for="h in history"
              :key="h.id"
              class="border-default bg-muted flex items-center gap-3 rounded-xl border px-4 py-3"
            >
              <UIcon name="i-lucide-clock" class="text-dimmed size-3.5" />
              <span class="flex-1 text-sm font-medium">{{ h.serviceName }}</span>
              <span class="text-dimmed font-mono text-xs">{{ fmtDate(h.startsAt, 'd MMM') }}</span>
              <span class="font-display text-base">{{ formatPrice(h.price) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- acciones -->
      <div class="border-default bg-default sticky bottom-0 flex gap-3 border-t px-5 py-4">
        <UButton
          color="neutral"
          variant="outline"
          size="lg"
          class="flex-1 justify-center"
          @click="reschedule"
          >Reprogramar</UButton
        >
        <UButton
          v-if="appt.status === 'booked'"
          color="primary"
          size="lg"
          class="flex-[1.5] justify-center"
          icon="i-lucide-check"
          @click="markDone"
          >Marcar hecha</UButton
        >
        <UButton
          v-else
          color="neutral"
          variant="soft"
          size="lg"
          class="flex-[1.5] justify-center"
          icon="i-lucide-undo-2"
          @click="revertToBooked"
          >{{ appt.status === 'no_show' ? 'Deshacer “no vino”' : 'Deshacer “hecha”' }}</UButton
        >
      </div>
    </template>

    <div v-else class="flex flex-1 items-center justify-center px-8">
      <UiEmptyState
        icon="i-lucide-calendar-x"
        title="Cita no encontrada"
        description="Puede que ya no esté en tu agenda."
      />
    </div>
  </div>
</template>
