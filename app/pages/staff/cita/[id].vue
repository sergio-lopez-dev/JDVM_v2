<script setup lang="ts">
import { fmtDate, formatPrice, formatDuration, initials } from '~~/lib/format'

definePageMeta({ layout: 'barber', middleware: 'barber' })
useHead({ title: 'Cita · Barbero' })

const route = useRoute()
const router = useRouter()
const toast = useToast()
const { setStatus } = useAppointments()
const { enriched } = useBarber()

const id = computed(() => route.params.id as string)
const appt = computed(() => enriched.value.find((a) => a.id === id.value) ?? null)

const PAY: Record<string, string> = { cash: 'Efectivo', revolut: 'Revolut' }

// Visitas anteriores del mismo cliente con este barbero.
const visits = computed(() =>
  appt.value ? enriched.value.filter((a) => a.clientId === appt.value!.clientId) : [],
)
const history = computed(() =>
  visits.value
    .filter((a) => a.id !== id.value && (a.status === 'completed' || a.startsAt.getTime() < Date.now()))
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())
    .slice(0, 5),
)

async function markDone() {
  if (!appt.value) return
  await setStatus(appt.value.id, 'completed')
  toast.add({ title: 'Cita marcada como hecha', icon: 'i-lucide-check', color: 'success' })
}
function reschedule() {
  toast.add({ title: 'Reprogramar', description: 'Pídeselo al administrador del local.', icon: 'i-lucide-calendar-clock' })
}
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-1 flex-col">
    <header class="flex items-center justify-between px-4 pt-4 pb-2 lg:px-0 lg:pt-6">
      <button type="button" aria-label="Volver" class="border-default bg-muted flex size-10 items-center justify-center rounded-xl border" @click="router.back()"><UIcon name="i-lucide-chevron-left" class="size-5" /></button>
      <span class="font-display text-lg">Cita</span>
      <div class="size-10" />
    </header>

    <template v-if="appt">
      <div class="flex-1 space-y-5 overflow-y-auto px-5 pt-2 pb-28">
        <!-- cliente -->
        <div class="text-center">
          <div class="border-primary/40 bg-elevated mx-auto flex size-16 items-center justify-center rounded-full border text-lg font-semibold">{{ initials(appt.clientName) }}</div>
          <h1 class="font-display mt-3 text-3xl leading-none">{{ appt.clientName }}</h1>
          <div class="text-toned mt-2 flex items-center justify-center gap-2.5 text-xs">
            <span>{{ visits.length >= 3 ? 'Cliente habitual' : 'Cliente' }}</span>
            <span class="bg-dimmed size-0.5 rounded-full" style="background: var(--jdvm-fg-2)" />
            <span class="flex items-center gap-1"><UIcon name="i-lucide-star" class="text-primary size-3" />{{ visits.length }} visitas</span>
          </div>
        </div>

        <!-- datos -->
        <div class="border-default bg-muted rounded-2xl border px-4">
          <div class="border-default flex items-center gap-3 border-b py-3.5">
            <div class="bg-accented flex size-9 items-center justify-center rounded-[10px]"><UIcon name="i-lucide-scissors" class="text-primary size-4" /></div>
            <div class="flex-1"><div class="text-dimmed text-[0.7rem]">Servicio</div><div class="text-sm font-semibold">{{ appt.serviceName }} · {{ formatDuration(appt.serviceDuration) }}</div></div>
          </div>
          <div class="border-default flex items-center gap-3 border-b py-3.5">
            <div class="bg-accented flex size-9 items-center justify-center rounded-[10px]"><UIcon name="i-lucide-clock" class="text-primary size-4" /></div>
            <div class="flex-1"><div class="text-dimmed text-[0.7rem]">Hora</div><div class="text-sm font-semibold capitalize">{{ fmtDate(appt.startsAt, 'EEE d') }} · {{ fmtDate(appt.startsAt, 'HH:mm') }}–{{ fmtDate(appt.endsAt, 'HH:mm') }}</div></div>
          </div>
          <div class="flex items-center gap-3 py-3.5">
            <div class="bg-accented flex size-9 items-center justify-center rounded-[10px]"><UIcon name="i-lucide-euro" class="text-primary size-4" /></div>
            <div class="flex-1"><div class="text-dimmed text-[0.7rem]">Importe</div><div class="text-sm font-semibold">{{ formatPrice(appt.price) }}<span v-if="appt.paymentMethod"> · {{ PAY[appt.paymentMethod] }}</span></div></div>
            <AdminPill :kind="appt.status === 'completed' ? 'done' : 'pending'">{{ appt.status === 'completed' ? 'Pagado' : 'Pendiente' }}</AdminPill>
          </div>
        </div>

        <!-- contacto -->
        <a v-if="appt.clientPhone" :href="`tel:${appt.clientPhone}`" class="border-default bg-muted flex items-center gap-3 rounded-2xl border p-4">
          <UIcon name="i-lucide-phone" class="text-primary size-5" />
          <span class="flex-1 text-sm font-semibold">Llamar al cliente</span>
          <span class="text-dimmed font-mono text-xs">{{ appt.clientPhone }}</span>
        </a>

        <!-- últimas visitas -->
        <div v-if="history.length">
          <p class="text-dimmed mb-2.5 font-mono text-[0.6rem] tracking-[0.15em] uppercase">Últimas visitas</p>
          <div class="space-y-2">
            <div v-for="h in history" :key="h.id" class="border-default bg-muted flex items-center gap-3 rounded-xl border px-4 py-3">
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
        <UButton color="neutral" variant="outline" size="lg" class="flex-1 justify-center" @click="reschedule">Reprogramar</UButton>
        <UButton v-if="appt.status === 'booked'" color="primary" size="lg" class="flex-[1.5] justify-center" icon="i-lucide-check" @click="markDone">Marcar hecha</UButton>
        <UButton v-else color="neutral" variant="subtle" size="lg" class="flex-[1.5] justify-center" disabled>{{ appt.status === 'completed' ? 'Completada' : 'No vino' }}</UButton>
      </div>
    </template>

    <div v-else class="flex flex-1 items-center justify-center px-8">
      <UiEmptyState icon="i-lucide-calendar-x" title="Cita no encontrada" description="Puede que ya no esté en tu agenda." />
    </div>
  </div>
</template>
