<script setup lang="ts">
import type { PaymentMethod } from '~~/schemas'

// Marca cómo se cobró una cita: efectivo (por defecto) o tarjeta. El barbero/admin
// lo conmuta sobre una cita ya cobrada; alimenta el desglose de facturación.
const props = defineProps<{ id: string; method?: PaymentMethod }>()

const { update } = useAppointments()

// Estado local optimista: el `selected` de los drawers es una copia (spread) que no
// se re-deriva tras escribir en Firestore, así que reflejamos el cambio al instante
// y lo resincronizamos si cambia la cita mostrada.
const current = ref<PaymentMethod>(props.method === 'card' ? 'card' : 'cash')
watch(
  () => [props.id, props.method],
  () => (current.value = props.method === 'card' ? 'card' : 'cash'),
)

const saving = ref(false)
const OPTIONS = [
  { value: 'cash', label: 'Efectivo', icon: 'i-lucide-banknote' },
  { value: 'card', label: 'Tarjeta', icon: 'i-lucide-credit-card' },
] as const

async function set(m: PaymentMethod) {
  if (m === current.value || saving.value) return
  const prev = current.value
  current.value = m
  saving.value = true
  try {
    await update(props.id, { paymentMethod: m })
  } catch {
    current.value = prev
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="border-default grid grid-cols-2 gap-1 rounded-xl border p-1">
    <button
      v-for="o in OPTIONS"
      :key="o.value"
      type="button"
      class="flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition"
      :class="current === o.value ? 'bg-primary text-inverted' : 'text-toned hover:bg-elevated'"
      :disabled="saving"
      @click="set(o.value)"
    >
      <UIcon :name="o.icon" class="size-4" />{{ o.label }}
    </button>
  </div>
</template>
