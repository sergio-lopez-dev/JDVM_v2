<script setup lang="ts">
// Marca JDVM. Logo real recuperado del legacy (blanco sobre transparente).
//  - variant 'lockup' (def): emblema + "•JDVM•"  → /logo-jdvm.png
//  - variant 'mark'        : solo el emblema       → /logo-jdvm-mark.png
//  - variant 'wordmark'    : wordmark tipográfico (sin imagen)
// `src` permite forzar otra ruta. `size` = altura en px.
const props = withDefaults(
  defineProps<{
    size?: number
    variant?: 'lockup' | 'mark' | 'wordmark'
    src?: string
  }>(),
  { size: 24, variant: 'lockup' },
)

const FILES = { lockup: '/logo-jdvm.png', mark: '/logo-jdvm-mark.png' } as const
const resolvedSrc = computed(() =>
  props.src ?? (props.variant === 'wordmark' ? undefined : FILES[props.variant]),
)
</script>

<template>
  <img
    v-if="resolvedSrc"
    :src="resolvedSrc"
    alt="JDVM Hair Studio"
    class="block w-auto"
    :style="{ height: `${props.size}px` }"
  />
  <span
    v-else
    class="font-display text-default block leading-none tracking-[0.18em] select-none"
    :style="{ fontSize: `${props.size}px` }"
    aria-label="JDVM Hair Studio"
    >JDVM</span
  >
</template>
