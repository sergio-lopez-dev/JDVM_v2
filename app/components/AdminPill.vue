<script setup lang="ts">
// Pastilla de estado para citas y similares.
type Kind = 'confirmed' | 'done' | 'pending' | 'cancelled' | 'neutral'
const props = withDefaults(defineProps<{ kind?: Kind }>(), { kind: 'neutral' })

const MAP: Record<Kind, string> = {
  confirmed: 'text-primary bg-primary/12 border-primary/30',
  done: 'text-success border-success/30',
  pending: 'text-warning border-warning/30',
  cancelled: 'text-error border-error/30',
  neutral: 'text-toned bg-accented border-default',
}
const dotColor: Record<Kind, string> = {
  confirmed: 'var(--jdvm-accent)',
  done: 'var(--jdvm-success)',
  pending: 'var(--jdvm-warning)',
  cancelled: 'var(--jdvm-danger)',
  neutral: 'var(--jdvm-fg-2)',
}
const tintBg: Record<Kind, string> = {
  confirmed: '',
  done: 'background: rgba(111,169,138,0.13)',
  pending: 'background: rgba(212,162,76,0.13)',
  cancelled: 'background: rgba(196,106,76,0.13)',
  neutral: '',
}
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.72rem] font-semibold whitespace-nowrap"
    :class="MAP[props.kind]"
    :style="tintBg[props.kind]"
  >
    <span class="size-1.5 rounded-full" :style="{ background: dotColor[props.kind] }" />
    <slot />
  </span>
</template>
