<script setup lang="ts">
// Grano sutil para que el fondo oscuro no quede plano (igual que en el diseño).
// Pensado para ir como overlay dentro de un contenedor `relative`.
const props = withDefaults(defineProps<{ opacity?: number }>(), { opacity: 0.4 })

const uri =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='2' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E"

const style = computed(() => ({
  backgroundImage: `url("${uri}")`,
  backgroundSize: '160px 160px',
  opacity: props.opacity,
}))
</script>

<template>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-0 z-0 mix-blend-overlay"
    :style="style"
  />
</template>
