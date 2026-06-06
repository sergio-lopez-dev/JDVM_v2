<script setup lang="ts">
// Logo de la marca (white-label). Si el admin ha subido logos (settings.studio),
// se usan esos; si no, se cae al logo por defecto recuperado del legacy.
//  - variant 'lockup' (def): logo completo  → studio.logoUrl     | /logo-jdvm.png
//  - variant 'mark'        : solo emblema    → studio.logoMarkUrl | /logo-jdvm-mark.png
//  - variant 'wordmark'    : nombre tipográfico (sin imagen)
// `src` permite forzar otra ruta. `size` = altura en px.
const props = withDefaults(
  defineProps<{
    size?: number
    variant?: 'lockup' | 'mark' | 'wordmark'
    src?: string
  }>(),
  { size: 24, variant: 'lockup' },
)

const { studio, name } = useStudio()

const FALLBACK = { lockup: '/logo-jdvm.png', mark: '/logo-jdvm-mark.png' } as const
const resolvedSrc = computed(() => {
  if (props.src) return props.src
  if (props.variant === 'wordmark') return undefined
  const custom = props.variant === 'mark' ? studio.value.logoMarkUrl : studio.value.logoUrl
  // El mark cae al lockup subido si no hay mark propio, y de ahí al logo por defecto.
  return custom || (props.variant === 'mark' ? studio.value.logoUrl : '') || FALLBACK[props.variant]
})
</script>

<template>
  <img
    v-if="resolvedSrc"
    :src="resolvedSrc"
    :alt="name"
    class="block w-auto"
    :style="{ height: `${props.size}px` }"
  />
  <span
    v-else
    class="font-display text-default block leading-none tracking-[0.18em] uppercase select-none"
    :style="{ fontSize: `${props.size}px` }"
    :aria-label="name"
    >{{ name }}</span
  >
</template>
