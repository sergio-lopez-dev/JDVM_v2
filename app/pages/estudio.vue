<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'El estudio' })

const { active: barbers } = useBarbers()
const { images } = useImages()
const { settings } = useSettings()

// Galería real (Storage). Antes se usaba un masonry con CSS `columns`, que en móvil
// con muchas fotos disparaba el coste de layout/memoria y reventaba la pestaña
// ("la página ha tenido problemas repetidamente"). Ahora un grid simple con
// lazy-load fiable: el navegador solo decodifica lo visible.
const gallery = computed(() =>
  images.value.map((img) => ({
    id: img.id,
    src: img.url,
    label: img.caption || 'trabajo',
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
      <!-- galería (grid con lazy-load + content-visibility: en iOS las fotos fuera de
           pantalla no se decodifican/retienen → memoria acotada, sin crash) -->
      <div v-if="gallery.length" class="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 lg:gap-4">
        <div
          v-for="g in gallery"
          :key="g.id"
          class="relative"
          style="content-visibility: auto; contain-intrinsic-size: auto 300px"
        >
          <UiPhoto :src="g.src" :label="g.label" :radius="14" ratio="3 / 4" />
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
