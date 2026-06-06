<script setup lang="ts">
import { formatPrice, formatDuration } from '~~/lib/format'

definePageMeta({ layout: 'inner', middleware: 'auth' })
useHead({ title: 'La carta' })

const { publicServices } = useServices()
const { categories } = useServiceCategories()
const { studio } = useStudio()
const cartaSub = computed(() =>
  studio.value.city ? `${studio.value.name} · ${studio.value.city.split(',')[0]}` : studio.value.name,
)

const groups = computed(() => {
  const known = new Set(categories.value.map((c) => c.id))
  const list = categories.value.map((c) => ({
    label: c.name,
    items: publicServices.value.filter((s) => s.category === c.id),
  }))
  const orphans = publicServices.value.filter((s) => !s.category || !known.has(s.category))
  if (orphans.length) list.push({ label: 'Otros', items: orphans })
  return list.filter((g) => g.items.length)
})
</script>

<template>
  <div class="flex flex-1 flex-col">
    <AppBar title="La carta" :sub="cartaSub">
      <template #right><UiStarRating :model-value="5" readonly :size="12" /></template>
    </AppBar>

    <div class="flex-1 space-y-6 px-5 py-4">
      <section v-for="g in groups" :key="g.label">
        <div class="mb-3 flex items-center gap-3">
          <h2 class="text-primary font-display text-lg">{{ g.label }}</h2>
          <span class="bg-border h-px flex-1" />
        </div>
        <div>
          <div
            v-for="(s, i) in g.items"
            :key="s.id"
            class="flex items-center gap-3 py-3"
            :class="i ? 'border-default border-t' : ''"
          >
            <div class="flex-1">
              <p class="text-sm font-semibold">{{ s.name }}</p>
              <p class="text-dimmed mt-0.5 text-xs">{{ s.description }}</p>
              <p class="text-muted mt-1.5 flex items-center gap-1.5 font-mono text-[0.65rem]">
                <UIcon name="i-lucide-clock" class="text-dimmed size-3" />{{ formatDuration(s.durationMinutes) }}
              </p>
            </div>
            <p class="font-display shrink-0 text-2xl">{{ formatPrice(s.basePrice) }}</p>
          </div>
        </div>
      </section>

      <UiEmptyState v-if="!groups.length" title="Carta vacía" description="Aún no hay servicios cargados." />
    </div>

    <div class="border-default bg-default sticky bottom-0 border-t px-5 py-3">
      <UButton to="/reservar" color="primary" size="lg" block icon="i-lucide-scissors">
        Reservar ahora
      </UButton>
    </div>
  </div>
</template>
