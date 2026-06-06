<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'El estudio' })

const { active: barbers } = useBarbers()
const { images } = useImages()
const { settings } = useSettings()

// Galería real (Storage). Alturas variables para el efecto masonry.
const HEIGHTS = [168, 132, 130, 170, 150, 148]
const gallery = computed(() =>
  images.value.map((img, i) => ({
    id: img.id,
    src: img.url,
    label: img.caption || 'trabajo',
    h: HEIGHTS[i % HEIGHTS.length],
  })),
)

const igUrl = computed(() => {
  const h = settings.value?.studio?.instagram
  if (!h) return ''
  return h.startsWith('http') ? h : `https://instagram.com/${h.replace(/^@/, '')}`
})
</script>

<template>
  <div class="mx-auto flex w-full max-w-5xl flex-1 flex-col lg:max-w-[1280px]">
    <header class="flex items-end justify-between px-5 pt-5 pb-2 lg:px-8 lg:pt-10 lg:pb-5">
      <div>
        <p class="text-dimmed lg:text-primary font-mono text-[0.6rem] tracking-[0.15em] uppercase lg:text-[0.7rem]">Nuestro trabajo</p>
        <h1 class="font-display mt-1 text-3xl leading-none lg:mt-2.5 lg:text-5xl">El estudio</h1>
      </div>
      <UButton :to="igUrl || undefined" :href="igUrl || undefined" target="_blank" rel="noopener" color="neutral" variant="outline" icon="i-lucide-instagram" class="shrink-0" :disabled="!igUrl">
        <span class="hidden lg:inline">Síguenos en Instagram</span>
      </UButton>
    </header>

    <div class="flex-1 space-y-7 px-5 py-3 lg:px-8 lg:py-5">
      <!-- galería masonry (CSS columns) -->
      <div v-if="gallery.length" class="columns-2 gap-2.5 sm:columns-3 lg:columns-4 lg:gap-4 [&>*]:mb-2.5 lg:[&>*]:mb-4">
        <div v-for="g in gallery" :key="g.id" class="relative break-inside-avoid">
          <UiPhoto :src="g.src" :label="g.label" :height="g.h" :radius="14" />
        </div>
      </div>
      <UiEmptyState v-else icon="i-lucide-image" title="Galería en preparación" description="Pronto subiremos fotos de nuestros trabajos." />

      <!-- equipo -->
      <section>
        <h2 class="font-display mb-3 text-xl">Nuestro equipo</h2>
        <div class="flex gap-4 overflow-x-auto pb-1 lg:grid lg:grid-cols-4 lg:gap-5 lg:overflow-visible xl:grid-cols-6">
          <NuxtLink
            v-for="b in barbers"
            :key="b.id"
            :to="`/barbero/${b.slug}`"
            class="flex shrink-0 flex-col items-center gap-2"
          >
            <UiAvatar :name="b.name" :src="b.photoUrl || null" :size="72" :ring="b.color" />
            <span class="text-muted text-xs font-medium">{{ b.name }}</span>
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
