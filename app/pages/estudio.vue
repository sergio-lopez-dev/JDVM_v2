<script setup lang="ts">
import { initials } from '~~/lib/format'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'El estudio · JDVM' })

const { active: barbers } = useBarbers()

const tabs = ['Todo', 'Cortes', 'Barba', 'Color', 'Navaja']
const activeTab = ref('Todo')

// Galería de ejemplo (placeholder; la colección de imágenes se modela más adelante).
const gallery = [
  { label: 'fade clásico', h: 168, likes: 84 },
  { label: 'barba perfilada', h: 132, likes: 51 },
  { label: 'texturizado', h: 130, likes: 73 },
  { label: 'mid fade', h: 170, likes: 122 },
  { label: 'diseño navaja', h: 150, likes: 96 },
  { label: 'pompadour', h: 148, likes: 64 },
]
const columns = computed(() => [
  gallery.filter((_, i) => i % 2 === 0),
  gallery.filter((_, i) => i % 2 === 1),
])
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header class="flex items-center justify-between px-5 pt-5 pb-2">
      <div>
        <p class="text-dimmed font-mono text-[0.6rem] tracking-[0.15em] uppercase">Nuestro trabajo</p>
        <h1 class="font-display mt-1 text-3xl leading-none">El estudio</h1>
      </div>
      <div class="border-default bg-elevated flex size-9 items-center justify-center rounded-xl border">
        <UIcon name="i-lucide-instagram" class="text-muted size-4" />
      </div>
    </header>

    <!-- filtros -->
    <div class="flex gap-2 overflow-x-auto px-5 py-2">
      <button
        v-for="t in tabs"
        :key="t"
        type="button"
        class="shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium"
        :class="
          t === activeTab
            ? 'bg-primary text-inverted border-primary'
            : 'bg-elevated border-default text-muted'
        "
        @click="activeTab = t"
      >
        {{ t }}
      </button>
    </div>

    <div class="flex-1 space-y-6 px-5 py-3">
      <!-- galería masonry -->
      <div class="grid grid-cols-2 gap-2.5">
        <div v-for="(col, ci) in columns" :key="ci" class="flex flex-col gap-2.5">
          <div v-for="g in col" :key="g.label" class="relative">
            <UiPhoto :label="g.label" :height="g.h" :radius="14" />
            <span class="absolute top-2 right-2 flex items-center gap-1 rounded-full bg-black/45 px-1.5 py-0.5 text-[0.6rem] font-semibold text-white backdrop-blur">
              <UIcon name="i-lucide-heart" class="size-2.5" />{{ g.likes }}
            </span>
          </div>
        </div>
      </div>

      <!-- equipo -->
      <section>
        <h2 class="font-display mb-3 text-xl">Nuestro equipo</h2>
        <div class="flex gap-4 overflow-x-auto pb-1">
          <NuxtLink
            v-for="b in barbers"
            :key="b.id"
            :to="`/barbero/${b.slug}`"
            class="flex shrink-0 flex-col items-center gap-2"
          >
            <div
              class="flex size-16 items-center justify-center rounded-full border text-base font-semibold"
              :style="{ borderColor: b.color, color: b.color }"
            >
              {{ initials(b.name) }}
            </div>
            <span class="text-muted text-xs font-medium">{{ b.name }}</span>
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
