<script setup lang="ts">
withDefaults(defineProps<{ pad?: boolean }>(), { pad: true })
</script>

<template>
  <div class="border-default bg-muted overflow-hidden rounded-2xl border" :class="pad ? 'p-5' : ''">
    <slot />
  </div>
</template>
