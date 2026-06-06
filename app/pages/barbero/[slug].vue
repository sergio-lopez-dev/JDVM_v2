<script setup lang="ts">
import { initials } from '~~/lib/format'

definePageMeta({ layout: 'inner', middleware: 'auth' })

const route = useRoute()
const { bySlug } = useBarbers()
const barber = bySlug(route.params.slug as string)

const { reviews } = useReviews()
const { publicServices } = useServices()
const { images } = useImages()
const { name: studioName } = useStudio()

const barberReviews = computed(() =>
  barber.value ? reviews.value.filter((r) => r.barberId === barber.value!.id) : [],
)
const avg = computed(() => {
  const list = barberReviews.value
  return list.length ? list.reduce((s, r) => s + r.score, 0) / list.length : 0
})
const firstName = computed(() => barber.value?.name.split(' ')[0] ?? '')

// Etiquetas = servicios que ofrece el barbero (nombres reales del catálogo).
const chips = computed(() =>
  barber.value
    ? (barber.value.servicesOffered ?? [])
        .map((id) => publicServices.value.find((s) => s.id === id)?.name)
        .filter(Boolean)
        .slice(0, 4)
    : [],
)
// Trabajos = imágenes de la galería atribuidas a este barbero.
const works = computed(() =>
  barber.value ? images.value.filter((img) => img.barberId === barber.value!.id) : [],
)
const stats = computed(() => [
  { n: avg.value ? avg.value.toFixed(1).replace('.', ',') : '—', l: 'Valoración' },
  { n: String(barberReviews.value.length), l: 'Reseñas' },
  { n: String(barber.value?.servicesOffered?.length ?? 0), l: 'Servicios' },
])

useHead(() => ({ title: barber.value ? `${barber.value.name}` : 'Barbero' }))
</script>

<template>
  <div v-if="barber" class="flex flex-1 flex-col">
    <div class="flex-1">
      <!-- hero -->
      <div class="relative h-60">
        <img v-if="barber.photoUrl" :src="barber.photoUrl" :alt="barber.name" class="size-full object-cover" />
        <UiPhoto v-else :label="`${firstName.toLowerCase()} · retrato`" :height="240" :radius="0" />
        <div class="absolute inset-0" style="background: linear-gradient(to top, var(--jdvm-bg-0) 4%, transparent 55%)" />
        <button
          type="button"
          aria-label="Volver"
          class="border-default absolute top-3 left-4 flex size-9 items-center justify-center rounded-xl border bg-black/40 backdrop-blur"
          @click="$router.back()"
        >
          <UIcon name="i-lucide-chevron-left" class="size-5" />
        </button>
      </div>

      <div class="-mt-9 px-5">
        <div class="flex items-end justify-between">
          <div>
            <h1 class="font-display text-3xl leading-none">{{ barber.name }}</h1>
            <p class="text-muted mt-1.5 text-xs">Barbero · {{ studioName }}</p>
          </div>
          <div class="text-right">
            <UiStarRating :model-value="Math.round(avg) || 5" readonly :size="14" />
            <p class="text-dimmed mt-1 text-[0.7rem]">
              {{ (avg || 5).toFixed(1) }} · {{ barberReviews.length }} reseñas
            </p>
          </div>
        </div>

        <p class="text-muted mt-3.5 text-sm leading-relaxed">{{ barber.bio }}</p>

        <div v-if="chips.length" class="mt-3.5 flex flex-wrap gap-2">
          <span
            v-for="c in chips"
            :key="c"
            class="bg-elevated border-default text-muted rounded-full border px-3 py-1.5 text-xs font-medium"
            >{{ c }}</span
          >
        </div>
      </div>

      <!-- stats -->
      <div class="border-default bg-muted mx-5 mt-4 flex overflow-hidden rounded-2xl border">
        <div v-for="(s, i) in stats" :key="s.l" class="flex-1 px-2 py-3.5 text-center" :class="i ? 'border-default border-l' : ''">
          <p class="text-primary font-display text-2xl">{{ s.n }}</p>
          <p class="text-dimmed mt-0.5 text-[0.65rem]">{{ s.l }}</p>
        </div>
      </div>

      <!-- trabajos -->
      <template v-if="works.length">
        <div class="mt-6 mb-3 flex items-baseline justify-between px-5">
          <h2 class="font-display text-lg">Sus trabajos</h2>
          <NuxtLink to="/estudio" class="text-primary text-xs font-semibold">Ver galería</NuxtLink>
        </div>
        <div class="flex gap-2.5 overflow-x-auto px-5">
          <div v-for="w in works" :key="w.id" class="w-28 shrink-0">
            <UiPhoto :src="w.url" :label="w.caption || 'trabajo'" :height="112" :radius="12" />
          </div>
        </div>
      </template>

      <!-- reseñas -->
      <h2 class="font-display mt-6 mb-3 px-5 text-lg">Reseñas</h2>
      <div class="space-y-2.5 px-5 pb-4">
        <div
          v-for="r in barberReviews"
          :key="r.id"
          class="border-default bg-muted rounded-xl border p-4"
        >
          <div class="mb-2 flex items-center gap-2.5">
            <div class="bg-elevated border-default flex size-8 items-center justify-center rounded-full border text-xs font-semibold">
              {{ initials(r.clientName) }}
            </div>
            <span class="flex-1 text-sm font-semibold">{{ r.clientName ?? 'Cliente' }}</span>
            <UiStarRating :model-value="r.score" readonly :size="12" />
          </div>
          <p class="text-muted text-sm leading-relaxed">{{ r.text }}</p>
        </div>
        <UiEmptyState v-if="!barberReviews.length" icon="i-lucide-star" title="Aún sin reseñas" />
      </div>
    </div>

    <div class="border-default bg-default sticky bottom-0 flex items-center gap-3 border-t px-5 py-3">
      <div class="border-default bg-elevated flex size-11 shrink-0 items-center justify-center rounded-xl border">
        <UIcon name="i-lucide-message-circle" class="text-muted size-5" />
      </div>
      <UButton :to="`/reservar?barber=${barber.slug}`" color="primary" size="lg" block icon="i-lucide-scissors">
        Reservar con {{ firstName }}
      </UButton>
    </div>
  </div>

  <div v-else class="flex min-h-dvh items-center justify-center">
    <UiEmptyState icon="i-lucide-user-x" title="Barbero no encontrado" />
  </div>
</template>
