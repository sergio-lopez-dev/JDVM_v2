<script setup lang="ts">
import { initials } from '~~/lib/format'

withDefaults(defineProps<{ name?: string | null; src?: string | null; size?: number; ring?: string }>(), {
  size: 44,
})
</script>

<template>
  <div
    class="bg-elevated border-default relative flex shrink-0 items-center justify-center overflow-hidden rounded-full border font-semibold"
    :style="{
      width: `${size}px`,
      height: `${size}px`,
      fontSize: `${Math.round(size * 0.36)}px`,
      ...(ring ? { borderColor: ring } : {}),
    }"
  >
    <img v-if="src" :src="src" :alt="name || ''" class="size-full object-cover" loading="lazy" />
    <span v-else>{{ initials(name) }}</span>
  </div>
</template>
