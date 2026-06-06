<script setup lang="ts">
withDefaults(
  defineProps<{ title: string; sub?: string; searchPlaceholder?: string; showSearch?: boolean }>(),
  { showSearch: false, searchPlaceholder: 'Buscar…' },
)
const search = defineModel<string>('search', { default: '' })
</script>

<template>
  <header class="border-default bg-default sticky top-0 z-20 flex min-h-18 flex-wrap items-center gap-x-5 gap-y-3 border-b px-5 py-3.5 lg:px-7">
    <div class="min-w-0">
      <h1 class="font-display text-2xl leading-none lg:text-[1.6rem]">{{ title }}</h1>
      <p v-if="sub" class="text-dimmed mt-1.5 truncate text-xs">{{ sub }}</p>
    </div>

    <div class="ml-auto flex items-center gap-2.5">
      <label
        v-if="showSearch"
        class="border-default bg-muted hidden h-10 items-center gap-2.5 rounded-[10px] border px-3.5 sm:flex sm:w-64"
      >
        <UIcon name="i-lucide-search" class="text-dimmed size-4 shrink-0" />
        <input
          v-model="search"
          type="text"
          :placeholder="searchPlaceholder"
          class="text-default placeholder:text-dimmed w-full bg-transparent text-sm outline-none"
        />
      </label>

      <slot name="actions" />

      <NuxtLink
        to="/admin/notificaciones"
        aria-label="Avisos"
        class="border-default bg-muted text-toned relative flex size-10 items-center justify-center rounded-[10px] border"
      >
        <UIcon name="i-lucide-bell" class="size-[18px]" />
        <span class="bg-primary ring-muted absolute top-2 right-2 size-[7px] rounded-full ring-2" />
      </NuxtLink>
    </div>
  </header>
</template>
