<script setup lang="ts">
import { initials } from '~~/lib/format'

// Chip de cliente para las agendas del día (barbero/admin). Muestra el teléfono
// junto al nombre y, al pulsar, abre un modal con toda la info del cliente (sin
// llamar directamente). Vive dentro de filas que ya son <NuxtLink>, por eso el
// disparador es un <span> (no <a>/<button>) con @click.stop.prevent, y el modal se
// teletransporta a <body>.
const props = defineProps<{
  name?: string
  phone?: string | null
  email?: string | null
}>()

const open = ref(false)
const toast = useToast()

function call() {
  if (props.phone && import.meta.client) window.location.href = `tel:${props.phone}`
}
async function copy(value?: string | null) {
  if (!value || !import.meta.client) return
  try {
    await navigator.clipboard.writeText(value)
    toast.add({ title: 'Copiado', icon: 'i-lucide-check', color: 'success' })
  } catch {
    /* sin permiso de portapapeles */
  }
}
</script>

<template>
  <span
    role="button"
    tabindex="0"
    class="text-primary hover:text-primary/80 inline-flex shrink-0 cursor-pointer items-center gap-1 font-mono text-[0.7rem]"
    @click.stop.prevent="open = true"
    @keydown.enter.stop.prevent="open = true"
  >
    <UIcon :name="phone ? 'i-lucide-phone' : 'i-lucide-info'" class="size-3" />
    <span v-if="phone">{{ phone }}</span>
  </span>

  <Teleport to="body">
    <Transition
      enter-active-class="transition-opacity"
      leave-active-class="transition-opacity"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="open"
        class="fixed inset-0 z-[60] flex items-end justify-center sm:items-center"
        @click="open = false"
      >
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <div
          class="border-default bg-default relative w-full max-w-sm overflow-hidden rounded-t-3xl border sm:rounded-3xl"
          @click.stop
        >
          <header class="border-default flex items-center gap-3 border-b px-5 py-4">
            <div class="border-primary/40 bg-elevated flex size-12 items-center justify-center rounded-full border text-sm font-semibold">
              {{ initials(name) }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Cliente</p>
              <h2 class="font-display truncate text-xl leading-tight">{{ name || 'Cliente' }}</h2>
            </div>
            <button type="button" aria-label="Cerrar" class="text-muted flex size-8 items-center justify-center" @click="open = false">
              <UIcon name="i-lucide-x" class="size-5" />
            </button>
          </header>

          <div class="space-y-2.5 px-5 py-4">
            <!-- teléfono -->
            <div v-if="phone" class="border-default bg-muted flex items-center gap-3 rounded-2xl border p-3.5">
              <div class="bg-primary/15 flex size-9 shrink-0 items-center justify-center rounded-xl">
                <UIcon name="i-lucide-phone" class="text-primary size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-dimmed text-[0.7rem]">Teléfono</p>
                <p class="truncate font-mono text-sm font-semibold">{{ phone }}</p>
              </div>
              <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-copy" aria-label="Copiar" @click="copy(phone)" />
              <UButton color="primary" size="sm" icon="i-lucide-phone" @click="call">Llamar</UButton>
            </div>

            <!-- email -->
            <div v-if="email" class="border-default bg-muted flex items-center gap-3 rounded-2xl border p-3.5">
              <div class="bg-primary/15 flex size-9 shrink-0 items-center justify-center rounded-xl">
                <UIcon name="i-lucide-mail" class="text-primary size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-dimmed text-[0.7rem]">Email</p>
                <p class="truncate text-sm font-semibold">{{ email }}</p>
              </div>
              <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-copy" aria-label="Copiar" @click="copy(email)" />
            </div>

            <p v-if="!phone && !email" class="text-dimmed py-4 text-center text-sm">
              Este cliente no tiene teléfono ni email guardados.
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
