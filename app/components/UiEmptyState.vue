<script setup lang="ts">
// Estado vacío: icono + título + descripción opcional + slot para acción (CTA).
withDefaults(
  defineProps<{
    icon?: string
    title: string
    description?: string
  }>(),
  { icon: 'i-lucide-inbox' },
)
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
    <div class="bg-elevated border-default flex size-14 items-center justify-center rounded-2xl border">
      <UIcon :name="icon" class="text-dimmed size-6" />
    </div>
    <div class="space-y-1">
      <p class="font-display text-default text-xl">{{ title }}</p>
      <p v-if="description" class="text-muted mx-auto max-w-xs text-sm">{{ description }}</p>
    </div>
    <slot />
  </div>
</template>
