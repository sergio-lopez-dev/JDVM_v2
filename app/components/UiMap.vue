<script setup lang="ts">
// Mapa embebido de Google Maps SIN API key (?q=<dirección>&output=embed). Se ubica
// el pin con la dirección del estudio (o nombre+ciudad como fallback). En tema oscuro
// aplicamos el truco de invertir para que el mapa case con la UI forest. Si no hay
// consulta, cae al placeholder a rayas de UiPhoto.
const props = withDefaults(
  defineProps<{
    query?: string // dirección o "nombre, ciudad" para situar el pin
    href?: string // enlace externo a Google Maps ("Cómo llegar")
    zoom?: number
    title?: string
  }>(),
  { zoom: 15, title: 'Mapa de ubicación' },
)

const embedSrc = computed(() => {
  const q = (props.query || '').trim()
  return q ? `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=${props.zoom}&output=embed` : ''
})
</script>

<template>
  <div class="relative size-full">
    <iframe
      v-if="embedSrc"
      :src="embedSrc"
      :title="title"
      class="size-full border-0 [filter:invert(0.92)_hue-rotate(180deg)_brightness(0.95)_contrast(0.9)]"
      loading="lazy"
      referrerpolicy="no-referrer-when-downgrade"
      allowfullscreen
    />
    <UiPhoto v-else label="mapa" :radius="0" class="absolute inset-0 size-full !border-0" />
    <a
      v-if="href"
      :href="href"
      target="_blank"
      rel="noopener"
      class="bg-primary text-inverted absolute right-3 bottom-3 z-10 flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold shadow-lg transition hover:opacity-90"
    >
      <UIcon name="i-lucide-navigation" class="size-3.5" />Cómo llegar
    </a>
  </div>
</template>
