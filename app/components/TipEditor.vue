<script setup lang="ts">
// Propina de una cita: la añaden el barbero o el admin. Va 100% para el barbero y
// alimenta "Mis ingresos" (`useBarber`/`useFinance` ya suman `appointment.tip`).
const props = defineProps<{ id: string; tip?: number }>()
const emit = defineEmits<{ changed: [number] }>()

const { update } = useAppointments()

// Estado optimista local: los drawers pasan una copia (spread) de la cita que no se
// re-deriva tras escribir en Firestore; reflejamos el cambio al instante.
const current = ref<number>(props.tip ?? 0)
watch(
  () => [props.id, props.tip],
  () => (current.value = props.tip ?? 0),
)
const customValue = ref<string>('')
const saving = ref(false)
const PRESETS = [0, 1, 2, 3, 5]

async function set(v: number) {
  const n = Math.max(0, Math.round(v))
  if (saving.value || n === current.value) {
    customValue.value = ''
    return
  }
  const prev = current.value
  current.value = n
  saving.value = true
  try {
    await update(props.id, { tip: n })
    emit('changed', n)
  } catch {
    current.value = prev
  } finally {
    saving.value = false
    customValue.value = ''
  }
}
function applyCustom() {
  const n = Number(customValue.value)
  if (Number.isFinite(n) && n >= 0) set(n)
}
</script>

<template>
  <div class="border-default bg-muted rounded-2xl border p-4">
    <div class="mb-2.5 flex items-center justify-between gap-3">
      <span class="flex items-center gap-2 text-sm font-semibold"
        ><UIcon name="i-lucide-gift" class="text-primary size-4" />Propina</span
      >
      <span class="font-display text-lg" :class="current > 0 ? 'text-primary' : 'text-dimmed'">{{
        current > 0 ? `${current}€` : 'Sin propina'
      }}</span>
    </div>
    <div class="flex flex-wrap items-center gap-1.5">
      <button
        v-for="p in PRESETS"
        :key="p"
        type="button"
        :disabled="saving"
        class="rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50"
        :class="
          current === p
            ? 'border-primary bg-primary text-inverted'
            : 'border-default bg-elevated text-toned hover:border-primary/40'
        "
        @click="set(p)"
      >
        {{ p === 0 ? 'Sin' : `${p}€` }}
      </button>
      <div class="flex items-center gap-1">
        <input
          v-model="customValue"
          type="number"
          min="0"
          inputmode="numeric"
          placeholder="Otra"
          class="border-default bg-elevated text-default w-16 rounded-lg border px-2 py-1.5 text-center text-xs [color-scheme:dark]"
          @keydown.enter.prevent="applyCustom"
        />
        <UButton
          color="neutral"
          variant="soft"
          size="xs"
          :disabled="saving || customValue === ''"
          icon="i-lucide-check"
          aria-label="Aplicar propina"
          @click="applyCustom"
        />
      </div>
    </div>
  </div>
</template>
