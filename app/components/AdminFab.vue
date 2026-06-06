<script setup lang="ts">
withDefaults(defineProps<{ icon?: string; label?: string }>(), { icon: 'i-lucide-plus', label: 'Añadir' })
defineEmits<{ click: [] }>()
</script>

<template>
  <button
    type="button"
    :aria-label="label"
    class="bg-primary text-inverted fixed right-5 bottom-20 z-30 flex size-14 items-center justify-center rounded-2xl shadow-xl shadow-black/40 active:scale-95 lg:hidden"
    @click="$emit('click')"
  >
    <UIcon :name="icon" class="size-6" />
  </button>
</template>
