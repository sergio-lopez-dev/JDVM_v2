<script setup lang="ts">
// Fotografía real (galería, retratos, mapa…) con fallback a placeholder a rayas
// cuando no hay `src`.
withDefaults(
  defineProps<{ src?: string | null; label?: string; height?: number; radius?: number; ratio?: string }>(),
  { radius: 12, ratio: '1 / 1' },
)
</script>

<template>
  <div
    class="border-default relative flex items-end overflow-hidden border"
    :style="{
      height: height ? `${height}px` : undefined,
      aspectRatio: height ? undefined : ratio,
      borderRadius: `${radius}px`,
      backgroundImage: src
        ? undefined
        : 'repeating-linear-gradient(135deg, var(--jdvm-bg-2) 0px, var(--jdvm-bg-2) 9px, var(--jdvm-bg-1) 9px, var(--jdvm-bg-1) 18px)',
    }"
  >
    <img v-if="src" :src="src" :alt="label || ''" class="absolute inset-0 size-full object-cover" loading="lazy" decoding="async" />
    <span
      v-if="label && !src"
      class="bg-default text-dimmed border-default m-2 rounded border px-1.5 py-0.5 font-mono text-[0.55rem] tracking-wide uppercase"
      >{{ label }}</span
    >
  </div>
</template>
