<script setup lang="ts">
import { effectivePrice, effectiveDuration, type Service } from '~~/schemas'
import { formatPrice, formatDuration } from '~~/lib/format'

// Cambiar el servicio realizado de una cita ya creada (p.ej. reservó "corte" pero al
// final fue "corte + barba"). Recalcula precio (priceSnapshot) y fin (endsAt) según el
// servicio y el barbero. Lo usan el staff (su cita) y el admin (drawers de agenda/citas).
const props = defineProps<{
  appointmentId: string
  barberId: string
  serviceId: string
  startsAt: Date
}>()
const emit = defineEmits<{
  changed: [{ serviceId: string; price: number; endsAt: Date; serviceName: string; serviceDuration: number }]
}>()

const toast = useToast()
const { services } = useServices()
const { barbers } = useBarbers()
const { update } = useAppointments()

const open = ref(false)
const saving = ref(false)

const barber = computed(() => barbers.value.find((b) => b.id === props.barberId) ?? null)
// Servicios que ese barbero ofrece (si no hay match, todos los públicos como red).
const options = computed(() => {
  const pub = services.value.filter((s) => !s.isPrivate)
  const offered = barber.value
    ? pub.filter((s) => barber.value!.servicesOffered?.includes(s.id))
    : pub
  return offered.length ? offered : pub
})

async function pick(s: Service) {
  if (s.id === props.serviceId) {
    open.value = false
    return
  }
  saving.value = true
  try {
    const dur = effectiveDuration(s, props.barberId)
    const price = effectivePrice(s, props.barberId)
    const endsAt = new Date(props.startsAt.getTime() + dur * 60_000)
    await update(props.appointmentId, { serviceId: s.id, priceSnapshot: price, endsAt })
    emit('changed', { serviceId: s.id, price, endsAt, serviceName: s.name, serviceDuration: dur })
    toast.add({ title: 'Servicio actualizado', description: `${s.name} · ${formatPrice(price)}`, icon: 'i-lucide-check', color: 'success' })
    open.value = false
  } catch (e) {
    toast.add({ title: 'No se pudo cambiar', description: (e as Error).message, color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <button
      type="button"
      class="border-default bg-muted hover:bg-elevated flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-left transition"
      @click="open = !open"
    >
      <UIcon name="i-lucide-replace" class="text-primary size-4 shrink-0" />
      <span class="flex-1 text-sm font-medium">Cambiar servicio</span>
      <UIcon :name="open ? 'i-lucide-chevron-up' : 'i-lucide-chevron-down'" class="text-dimmed size-4" />
    </button>
    <div v-if="open" class="mt-2 grid grid-cols-2 gap-2">
      <button
        v-for="s in options"
        :key="s.id"
        type="button"
        :disabled="saving"
        class="rounded-xl border p-2.5 text-left transition disabled:opacity-50"
        :class="s.id === serviceId ? 'border-primary/40 bg-primary/10' : 'border-default bg-muted hover:bg-elevated'"
        @click="pick(s)"
      >
        <p class="text-sm font-semibold">{{ s.name }}</p>
        <p class="text-dimmed font-mono text-[0.65rem]">{{ formatDuration(effectiveDuration(s, barberId)) }} · {{ formatPrice(effectivePrice(s, barberId)) }}</p>
      </button>
    </div>
  </div>
</template>
