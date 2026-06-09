<script setup lang="ts">
import { initials, fmtDate } from '~~/lib/format'
import { toDate } from '~~/lib/datetime'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Estudio · Admin' })

const { images, upload, remove: removeImage } = useImages()
const { reviews, remove: removeReview } = useReviews()
const { barbers } = useBarbers()
const toast = useToast()

const tab = ref<'galeria' | 'resenas'>('galeria')

// — Galería —
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

async function onFiles(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files?.length) return
  uploading.value = true
  try {
    for (const file of Array.from(files)) {
      if (!file.type.startsWith('image/')) continue
      await upload(file)
    }
    toast.add({ title: 'Imágenes subidas', icon: 'i-lucide-check', color: 'success' })
  } catch (err) {
    toast.add({ title: 'Error al subir', description: (err as Error).message, color: 'error' })
  } finally {
    uploading.value = false
    if (fileInput.value) fileInput.value.value = ''
  }
}

async function delImage(id: string) {
  const img = images.value.find((i) => i.id === id)
  if (!img) return
  if (!confirm('¿Eliminar esta imagen?')) return
  await removeImage(img)
  toast.add({ title: 'Imagen eliminada', icon: 'i-lucide-trash-2' })
}

// — Reseñas —
const enrichedReviews = computed(() =>
  [...reviews.value]
    .map((r) => ({
      ...r,
      created: r.createdAt ? toDate(r.createdAt) : null,
      barberName: barbers.value.find((b) => b.id === r.barberId)?.name ?? 'Barbero',
    }))
    .sort((a, b) => (b.created?.getTime() ?? 0) - (a.created?.getTime() ?? 0)),
)

async function delReview(id: string) {
  if (!confirm('¿Eliminar esta reseña?')) return
  await removeReview(id)
  toast.add({ title: 'Reseña eliminada', icon: 'i-lucide-trash-2' })
}
</script>

<template>
  <div>
    <AdminHeader title="Estudio" sub="Galería y reseñas">
      <template #actions>
        <div class="border-default flex overflow-hidden rounded-xl border text-sm">
          <button type="button" class="px-3 py-2 font-medium" :class="tab === 'galeria' ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-elevated'" @click="tab = 'galeria'">Galería</button>
          <button type="button" class="border-default border-l px-3 py-2 font-medium" :class="tab === 'resenas' ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-elevated'" @click="tab = 'resenas'">Reseñas</button>
        </div>
      </template>
    </AdminHeader>

    <div class="px-5 py-6 pb-24 lg:px-7 lg:pb-6">
      <!-- GALERÍA -->
      <div v-if="tab === 'galeria'" class="space-y-5">
        <div class="flex items-center justify-between">
          <p class="text-muted text-sm">{{ images.length }} imágenes</p>
          <input ref="fileInput" type="file" accept="image/*" multiple class="hidden" @change="onFiles" />
          <UButton color="primary" icon="i-lucide-upload" :loading="uploading" @click="fileInput?.click()">Subir imágenes</UButton>
        </div>

        <div v-if="images.length" class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          <div
            v-for="img in images"
            :key="img.id"
            class="group border-default bg-muted relative aspect-square overflow-hidden rounded-2xl border"
            style="content-visibility: auto; contain-intrinsic-size: auto 240px"
          >
            <img :src="img.url" :alt="img.caption || 'Trabajo del estudio'" class="size-full object-cover" loading="lazy" decoding="async" />
            <button
              type="button"
              aria-label="Eliminar"
              class="absolute top-2 right-2 flex size-8 items-center justify-center rounded-lg bg-black/60 text-white backdrop-blur transition-opacity hover:bg-error/80 lg:opacity-70 lg:group-hover:opacity-100"
              @click="delImage(img.id)"
            >
              <UIcon name="i-lucide-trash-2" class="size-4" />
            </button>
            <p v-if="img.caption" class="absolute right-0 bottom-0 left-0 truncate bg-gradient-to-t from-black/70 to-transparent px-2 pt-6 pb-1.5 text-[0.7rem] text-white">{{ img.caption }}</p>
          </div>
        </div>
        <UiEmptyState v-else icon="i-lucide-image" title="Galería vacía" description="Sube fotos de los trabajos del estudio para mostrarlas a los clientes." />
      </div>

      <!-- RESEÑAS -->
      <div v-else class="space-y-3">
        <div v-if="enrichedReviews.length" class="grid gap-3 lg:grid-cols-2">
          <div v-for="r in enrichedReviews" :key="r.id" class="border-default bg-muted rounded-2xl border p-4">
            <div class="flex items-center gap-3">
              <div class="bg-elevated border-default flex size-10 items-center justify-center rounded-full border text-xs font-semibold">{{ initials(r.clientName) }}</div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold">{{ r.clientName || 'Cliente' }}</p>
                <p class="text-dimmed text-xs">{{ r.barberName }}<span v-if="r.created"> · {{ fmtDate(r.created, 'd MMM yyyy') }}</span></p>
              </div>
              <UiStarRating :model-value="r.score" readonly :size="14" />
            </div>
            <p v-if="r.text" class="text-muted mt-3 text-sm leading-relaxed">{{ r.text }}</p>
            <div v-if="r.tags?.length" class="mt-3 flex flex-wrap gap-1.5">
              <span v-for="t in r.tags" :key="t" class="bg-elevated text-dimmed rounded-full px-2 py-0.5 font-mono text-[0.6rem]">{{ t }}</span>
            </div>
            <div class="border-default mt-3 flex justify-end border-t pt-3">
              <UButton size="xs" color="error" variant="ghost" icon="i-lucide-trash-2" @click="delReview(r.id)">Eliminar</UButton>
            </div>
          </div>
        </div>
        <UiEmptyState v-else icon="i-lucide-star" title="Sin reseñas" description="Cuando los clientes valoren sus citas aparecerán aquí." />
      </div>
    </div>
  </div>
</template>
