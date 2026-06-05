<script setup lang="ts">
withDefaults(defineProps<{ title?: string; sub?: string; back?: boolean }>(), { back: true })
const router = useRouter()
</script>

<template>
  <header class="flex items-center justify-between gap-2 px-5 pt-4 pb-3">
    <button
      v-if="back"
      type="button"
      aria-label="Volver"
      class="border-default bg-elevated flex size-9 shrink-0 items-center justify-center rounded-xl border"
      @click="router.back()"
    >
      <UIcon name="i-lucide-chevron-left" class="size-5" />
    </button>
    <div v-else class="size-9 shrink-0" />

    <div class="min-w-0 text-center">
      <h1 v-if="title" class="font-display truncate text-lg leading-tight">{{ title }}</h1>
      <p v-if="sub" class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">
        {{ sub }}
      </p>
    </div>

    <div class="flex size-9 shrink-0 items-center justify-end">
      <slot name="right" />
    </div>
  </header>
</template>
