<script setup lang="ts">
// Marca JDVM. Placeholder tipográfico (wordmark en la serif display) hasta tener
// el logo vectorial real: pasa `src` para usar una imagen/SVG cuando lo tengamos.
const props = withDefaults(
  defineProps<{
    src?: string
    size?: number
  }>(),
  { size: 24 },
)
</script>

<template>
  <img
    v-if="props.src"
    :src="props.src"
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
