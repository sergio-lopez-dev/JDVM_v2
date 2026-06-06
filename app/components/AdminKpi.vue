<script setup lang="ts">
defineProps<{
  icon: string
  label: string
  value: string | number
  delta?: string
  up?: boolean
}>()
</script>

<template>
  <div class="border-default bg-muted flex-1 rounded-2xl border p-5">
    <div class="mb-4 flex items-center justify-between">
      <div class="bg-primary/15 flex size-9 items-center justify-center rounded-[10px]">
        <UIcon :name="icon" class="text-primary size-[18px]" />
      </div>
      <span
        v-if="delta"
        class="inline-flex items-center gap-1 text-xs font-semibold"
        :class="up ? 'text-success' : 'text-error'"
      >
        <UIcon name="i-lucide-trending-up" class="size-3.5" :class="up ? '' : '-scale-y-100'" />{{ delta }}
      </span>
    </div>
    <div class="font-display text-[2.1rem] leading-none">{{ value }}</div>
    <div class="text-dimmed mt-2 text-[0.8rem]">{{ label }}</div>
  </div>
</template>
