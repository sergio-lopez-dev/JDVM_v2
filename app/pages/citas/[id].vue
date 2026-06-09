<script setup lang="ts">
import { fmtDate, formatPrice, formatDuration } from '~~/lib/format'
import { isCancellable, cancellationDeadline } from '~~/lib/cancellation'

definePageMeta({ layout: 'inner', middleware: 'auth' })
useHead({ title: 'Tu cita' })

const route = useRoute()
const toast = useToast()
const { byId } = useMyAppointments()
const { cancel } = useAppointments()
const { notifyCancellation } = useNotifications()
const { client } = useCurrentClient()
const { settings } = useSettings()
const appt = byId(route.params.id as string)

const cancelHours = computed(() => settings.value?.cancellationWindowHours ?? 4)
const cancellable = computed(() =>
  appt.value ? isCancellable(appt.value.startsAt, { hours: cancelHours.value }) : false,
)
const cancelling = ref(false)

async function doCancel() {
  if (!appt.value) return
  cancelling.value = true
  try {
    await cancel(appt.value.id, appt.value.startsAt)
    await notifyCancellation({
      barberId: appt.value.barberId,
      clientName: client.value?.name || 'Un cliente',
      serviceName: appt.value.serviceName,
      when: fmtDate(appt.value.startsAt, "EEE d MMM 'a las' HH:mm"),
      appointmentId: appt.value.id,
    })
    toast.add({ title: 'Cita cancelada', icon: 'i-lucide-check', color: 'primary' })
    await navigateTo('/app')
  } catch (e) {
    toast.add({ title: 'No se pudo cancelar', description: (e as Error).message, color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    cancelling.value = false
  }
}
</script>

<template>
  <div v-if="appt" class="flex flex-1 flex-col">
    <AppBar title="Tu cita">
      <template #right><UIcon name="i-lucide-share" class="text-muted size-5" /></template>
    </AppBar>

    <div class="flex-1 space-y-4 px-5 py-3">
      <span
        class="inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold"
        :class="appt.status === 'cancelled' ? 'border-default text-dimmed' : 'bg-primary/10 border-primary/30 text-primary'"
      >
        <span class="size-1.5 rounded-full" :class="appt.status === 'cancelled' ? 'bg-dimmed' : 'bg-primary'" />
        {{ appt.status === 'cancelled' ? 'Cancelada' : appt.status === 'completed' ? 'Completada' : 'Confirmada' }}
      </span>

      <div>
        <h1 class="font-display text-4xl leading-none capitalize">{{ fmtDate(appt.startsAt, "EEEE d 'de' MMM") }}</h1>
        <p class="text-primary font-display mt-1.5 text-2xl">
          {{ fmtDate(appt.startsAt, 'HH:mm') }} – {{ fmtDate(appt.endsAt, 'HH:mm') }}
        </p>
      </div>

      <div class="border-default relative overflow-hidden rounded-2xl border">
        <UiPhoto label="mapa · maracena" :height="130" :radius="0" />
        <div class="absolute right-3 bottom-3">
          <span class="bg-primary text-inverted flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold">
            <UIcon name="i-lucide-navigation" class="size-3.5" />Cómo llegar
          </span>
        </div>
      </div>

      <div class="border-default bg-muted rounded-2xl border px-4">
        <div class="border-default flex items-center gap-3 border-b py-3">
          <UIcon name="i-lucide-scissors" class="text-primary size-4" />
          <span class="text-muted flex-1 text-xs">Servicio</span>
          <span class="text-sm font-semibold">{{ appt.serviceName }} · {{ formatDuration(appt.serviceDuration) }}</span>
        </div>
        <div class="border-default flex items-center gap-3 border-b py-3">
          <UIcon name="i-lucide-user" class="text-primary size-4" />
          <span class="text-muted flex-1 text-xs">Barbero</span>
          <span class="text-sm font-semibold">{{ appt.barberName }}</span>
        </div>
        <div class="flex items-center gap-3 py-3">
          <UIcon name="i-lucide-tag" class="text-primary size-4" />
          <span class="text-muted flex-1 text-xs">Precio</span>
          <span class="text-sm font-semibold">{{ formatPrice(appt.price) }}</span>
        </div>
      </div>

      <div v-if="appt.status === 'booked'" class="border-default flex gap-2.5 rounded-xl border border-dashed p-3.5">
        <UIcon name="i-lucide-clock" class="text-dimmed size-4 shrink-0" />
        <span class="text-dimmed text-xs leading-relaxed">
          Puedes reprogramar o cancelar gratis hasta las
          {{ fmtDate(cancellationDeadline(appt.startsAt, cancelHours), "HH:mm 'del' EEEE") }}.
        </span>
      </div>
    </div>

    <!-- acciones -->
    <div class="border-default bg-default sticky bottom-0 flex gap-2.5 border-t px-5 py-3">
      <template v-if="appt.status === 'booked'">
        <UButton color="error" variant="outline" size="lg" class="flex-1 justify-center" :loading="cancelling" :disabled="!cancellable" @click="doCancel">Cancelar</UButton>
        <UButton to="/reservar" color="primary" size="lg" class="flex-[1.4] justify-center" icon="i-lucide-refresh-cw">Reprogramar</UButton>
      </template>
      <UButton v-else-if="appt.status === 'completed'" :to="`/valorar/${appt.id}`" color="primary" size="lg" block icon="i-lucide-star">Valorar visita</UButton>
      <UButton v-else to="/reservar" color="primary" size="lg" block icon="i-lucide-scissors">Reservar de nuevo</UButton>
    </div>
  </div>

  <div v-else class="flex min-h-dvh items-center justify-center">
    <UiEmptyState icon="i-lucide-calendar-x" title="Cita no encontrada" />
  </div>
</template>
