<script setup lang="ts">
// Styleguide del sistema de diseño. Solo dev: en prod devuelve 404.
if (!import.meta.dev) throw createError({ statusCode: 404, statusMessage: 'Not Found' })

useHead({ title: 'Styleguide · JDVM' })

// — Estados de ejemplo para los controles —
const inputVal = ref('')
const textVal = ref('')
const selectVal = ref('corte-barba')
const services = [
  { label: 'Corte de pelo · 13€', value: 'corte' },
  { label: 'Corte + barba · 18€', value: 'corte-barba' },
  { label: 'Arreglo de barba · 9€', value: 'barba' },
]
const checked = ref(true)
const switchOn = ref(true)
const period = ref('tarde')
const periods = [
  { label: 'Mañana', value: 'manana' },
  { label: 'Tarde', value: 'tarde' },
]
const rating = ref(4)

const tabs = [
  { label: 'Servicio', icon: 'i-lucide-scissors', slot: 'servicio' as const },
  { label: 'Fecha', icon: 'i-lucide-calendar', slot: 'fecha' as const },
  { label: 'Confirmar', icon: 'i-lucide-check', slot: 'confirmar' as const },
]

const toast = useToast()
function notify() {
  toast.add({
    title: '¡Cita confirmada!',
    description: 'Jueves 4 a las 17:30 con Dani Ruiz.',
    icon: 'i-lucide-check',
    color: 'primary',
  })
}

// — Muestras de color (leídas de los tokens crudos --jdvm-*) —
const surfaces = [
  ['bg / 0', '--jdvm-bg-0'],
  ['bg / 1', '--jdvm-bg-1'],
  ['bg / 2', '--jdvm-bg-2'],
]
const texts = [
  ['fg / 0', '--jdvm-fg-0'],
  ['fg / 1', '--jdvm-fg-1'],
  ['fg / 2', '--jdvm-fg-2'],
]
const accents = [
  ['accent', '--jdvm-accent'],
  ['hover', '--jdvm-accent-hover'],
  ['tint', '--jdvm-accent-tint'],
  ['soft', '--jdvm-accent-soft'],
]
const semantics = [
  ['success', '--jdvm-success'],
  ['warning', '--jdvm-warning'],
  ['danger', '--jdvm-danger'],
]
const serviceColors = [
  ['servicio A', '--jdvm-service-a'],
  ['servicio B', '--jdvm-service-b'],
  ['servicio C', '--jdvm-service-c'],
]
const buttonVariants = ['solid', 'outline', 'subtle', 'soft', 'ghost', 'link'] as const
const badgeColors = ['primary', 'neutral', 'success', 'warning', 'error'] as const
</script>

<template>
  <div class="mx-auto max-w-3xl space-y-14 px-6 py-14">
    <!-- header -->
    <header class="space-y-3">
      <AppLogo :size="30" />
      <p class="text-primary font-mono text-[0.7rem] tracking-[0.3em] uppercase">
        Sistema de diseño · forest
      </p>
      <h1 class="font-display text-default text-5xl leading-none">Styleguide</h1>
      <p class="text-muted text-sm">
        Tokens y componentes base de JDVM. Página solo visible en desarrollo.
      </p>
    </header>

    <!-- tipografía -->
    <section class="space-y-5">
      <h2 class="text-dimmed font-mono text-xs tracking-[0.2em] uppercase">Tipografía</h2>
      <div class="border-default space-y-3 border-t pt-5">
        <div class="flex items-baseline gap-4">
          <span class="font-display text-default text-6xl leading-none">18€</span>
          <span class="font-display text-primary text-6xl leading-none">24</span>
          <span class="font-display text-muted text-3xl italic">editorial</span>
        </div>
        <p class="text-dimmed font-mono text-xs">Libre Caslon Display · display & cifras</p>
        <p class="text-muted max-w-md text-sm leading-relaxed">
          Reserva con tu barbero de siempre. La sans limpia sostiene el cuerpo de texto y la
          interfaz a tamaños pequeños con claridad.
        </p>
        <p class="text-dimmed font-mono text-xs">Hanken Grotesk · cuerpo & UI · 11–16px</p>
        <p class="text-default font-mono text-sm">17:30 · JetBrains Mono · horas & labels</p>
      </div>
    </section>

    <!-- paleta -->
    <section class="space-y-5">
      <h2 class="text-dimmed font-mono text-xs tracking-[0.2em] uppercase">Paleta</h2>
      <div class="border-default space-y-6 border-t pt-5">
        <div v-for="row in [surfaces, texts, accents, semantics, serviceColors]" :key="row[0]![1]">
          <div class="grid grid-cols-3 gap-3 sm:grid-cols-6">
            <div v-for="[label, varName] in row" :key="varName" class="space-y-1.5">
              <div
                class="border-default h-12 rounded-lg border"
                :style="{ background: `var(${varName})` }"
              />
              <p class="text-muted text-[0.7rem] font-medium">{{ label }}</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- botones -->
    <section class="space-y-5">
      <h2 class="text-dimmed font-mono text-xs tracking-[0.2em] uppercase">Botones</h2>
      <div class="border-default space-y-4 border-t pt-5">
        <div class="flex flex-wrap items-center gap-3">
          <UButton
            v-for="v in buttonVariants"
            :key="v"
            :variant="v"
            color="primary"
            class="capitalize"
            >{{ v }}</UButton
          >
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UButton size="xs">xs</UButton>
          <UButton size="sm">sm</UButton>
          <UButton size="md">md</UButton>
          <UButton size="lg">lg</UButton>
          <UButton size="xl">xl</UButton>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UButton icon="i-lucide-scissors">Reservar</UButton>
          <UButton color="neutral" variant="outline" trailing-icon="i-lucide-arrow-right"
            >Continuar</UButton
          >
          <UButton color="primary" loading>Cargando</UButton>
          <UButton disabled>Deshabilitado</UButton>
          <UButton color="error" variant="ghost" icon="i-lucide-trash-2">Cancelar</UButton>
          <UButton color="primary" icon="i-lucide-scissors" square aria-label="Reservar" />
        </div>
      </div>
    </section>

    <!-- formularios -->
    <section class="space-y-5">
      <h2 class="text-dimmed font-mono text-xs tracking-[0.2em] uppercase">Formularios</h2>
      <div class="border-default grid gap-5 border-t pt-5 sm:grid-cols-2">
        <UFormField label="Teléfono" help="9 dígitos, sin prefijo.">
          <UInput v-model="inputVal" placeholder="600 000 000" icon="i-lucide-phone" class="w-full" />
        </UFormField>
        <UFormField label="Servicio">
          <USelect v-model="selectVal" :items="services" class="w-full" />
        </UFormField>
        <UFormField label="Comentario" class="sm:col-span-2">
          <UTextarea v-model="textVal" placeholder="Cuéntanos…" :rows="3" class="w-full" />
        </UFormField>
        <div class="flex flex-col gap-3">
          <UCheckbox v-model="checked" label="Recibir recordatorios" />
          <USwitch v-model="switchOn" label="Cualquier barbero disponible" />
        </div>
        <URadioGroup v-model="period" :items="periods" legend="Franja horaria" />
      </div>
    </section>

    <!-- feedback -->
    <section class="space-y-5">
      <h2 class="text-dimmed font-mono text-xs tracking-[0.2em] uppercase">
        Badges, avatares & estados
      </h2>
      <div class="border-default space-y-4 border-t pt-5">
        <div class="flex flex-wrap items-center gap-2">
          <UBadge v-for="c in badgeColors" :key="c" :color="c" variant="subtle" class="capitalize">{{
            c
          }}</UBadge>
        </div>
        <div class="flex flex-wrap items-center gap-3">
          <UAvatar text="DR" />
          <UAvatar text="MS" />
          <UAvatar text="AM" size="lg" />
          <UBadge color="success" variant="soft" icon="i-lucide-check">Hecha</UBadge>
          <UBadge color="primary" variant="soft" icon="i-lucide-clock">Próxima</UBadge>
        </div>
        <UAlert
          color="primary"
          variant="soft"
          icon="i-lucide-bell"
          title="Lista de espera"
          description="Te avisaremos en cuanto se libere un hueco que encaje con tus preferencias."
        />
        <div class="flex items-center gap-3">
          <USkeleton class="size-12 rounded-full" />
          <div class="space-y-2">
            <USkeleton class="h-3 w-40" />
            <USkeleton class="h-3 w-24" />
          </div>
        </div>
      </div>
    </section>

    <!-- estrellas -->
    <section class="space-y-5">
      <h2 class="text-dimmed font-mono text-xs tracking-[0.2em] uppercase">
        Valoración (custom)
      </h2>
      <div class="border-default flex flex-wrap items-center gap-8 border-t pt-5">
        <div class="space-y-2">
          <UiStarRating :model-value="5" readonly />
          <p class="text-dimmed text-xs">Display · 4,9 · 212 reseñas</p>
        </div>
        <div class="space-y-2">
          <UiStarRating v-model="rating" :size="32" />
          <p class="text-dimmed text-xs">Interactiva · {{ rating }}/5</p>
        </div>
      </div>
    </section>

    <!-- tabs + card -->
    <section class="space-y-5">
      <h2 class="text-dimmed font-mono text-xs tracking-[0.2em] uppercase">Tabs & Card</h2>
      <div class="border-default space-y-5 border-t pt-5">
        <UTabs :items="tabs">
          <template #servicio><p class="text-muted p-4 text-sm">Elige tu servicio.</p></template>
          <template #fecha><p class="text-muted p-4 text-sm">Elige fecha y hora.</p></template>
          <template #confirmar><p class="text-muted p-4 text-sm">Revisa y confirma.</p></template>
        </UTabs>

        <UCard>
          <template #header>
            <div class="flex items-center gap-3">
              <UAvatar text="DR" />
              <div>
                <p class="text-default font-medium">Corte + barba</p>
                <p class="text-muted text-sm">con Dani Ruiz</p>
              </div>
            </div>
          </template>
          <div class="flex items-center justify-between">
            <UiStarRating :model-value="5" readonly :size="16" />
            <span class="font-display text-default text-xl">18€</span>
          </div>
          <template #footer>
            <UButton block color="primary" icon="i-lucide-scissors">Reservar de nuevo</UButton>
          </template>
        </UCard>
      </div>
    </section>

    <!-- overlays -->
    <section class="space-y-5">
      <h2 class="text-dimmed font-mono text-xs tracking-[0.2em] uppercase">
        Overlays & notificaciones
      </h2>
      <div class="border-default flex flex-wrap items-center gap-3 border-t pt-5">
        <UModal title="Cancelar cita" description="¿Seguro que quieres cancelar tu cita del jueves?">
          <UButton color="error" variant="outline">Abrir modal</UButton>
          <template #footer>
            <UButton color="neutral" variant="ghost">Volver</UButton>
            <UButton color="error">Sí, cancelar</UButton>
          </template>
        </UModal>

        <UDrawer title="Filtros" description="Ajusta tus preferencias de búsqueda.">
          <UButton color="neutral" variant="outline">Abrir drawer</UButton>
          <template #body>
            <div class="flex flex-col gap-3 py-2">
              <USwitch label="Solo tardes" :model-value="true" />
              <USwitch label="Lun a vie" :model-value="false" />
            </div>
          </template>
        </UDrawer>

        <UTooltip text="Reservar una cita">
          <UButton color="neutral" variant="subtle" icon="i-lucide-info">Tooltip</UButton>
        </UTooltip>

        <UButton color="primary" variant="subtle" icon="i-lucide-bell" @click="notify"
          >Lanzar toast</UButton
        >
      </div>
    </section>

    <!-- empty state -->
    <section class="space-y-5">
      <h2 class="text-dimmed font-mono text-xs tracking-[0.2em] uppercase">Estado vacío</h2>
      <div class="border-default border-t pt-5">
        <div class="bg-muted border-default rounded-xl border">
          <UiEmptyState
            icon="i-lucide-calendar-x"
            title="Sin citas próximas"
            description="Cuando reserves una cita aparecerá aquí."
          >
            <UButton color="primary" variant="subtle" icon="i-lucide-scissors">Reservar</UButton>
          </UiEmptyState>
        </div>
      </div>
    </section>
  </div>
</template>
