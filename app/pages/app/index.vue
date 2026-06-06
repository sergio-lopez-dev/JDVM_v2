<script setup lang="ts">
import { fmtDate, formatPrice, formatDuration, initials } from '~~/lib/format'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Inicio' })

const user = useCurrentUser()
const { client, needsProfile } = useCurrentClient()
const { next, past } = useMyAppointments()
const { active: alerts } = useAlerts()
const { unreadMine } = useNotifications()
const { enabled: loyaltyEnabled, mySummary } = useLoyalty()
const { images } = useImages()
const { studio } = useStudio()
const cityShort = computed(() => (studio.value.city || '').split(',')[0]!.trim())

// Primeras imágenes de la galería del estudio (las sube el admin en /admin/estudio).
const gallery = computed(() => images.value.slice(0, 4))

watch(needsProfile, (v) => {
  if (v) navigateTo('/completar-perfil')
})

const heroVideo = '/video/hero.mp4'

const firstName = computed(() => (client.value?.name || user.value?.displayName || 'cliente').split(' ')[0])
const today = computed(() => fmtDate(new Date(), 'EEEE · d MMM'))
const avatarInitials = computed(() => initials(client.value?.name || user.value?.displayName))

function daysUntil(d: Date) {
  const ms = d.getTime() - Date.now()
  const days = Math.ceil(ms / 86_400_000)
  if (days <= 0) return 'hoy'
  if (days === 1) return 'mañana'
  return `en ${days} días`
}

// Servicio más reciente, para la acción rápida "Repetir".
const lastService = computed(() => past.value[0] ?? null)
const mapsUrl = computed(
  () => studio.value.mapsUrl || `https://maps.google.com/?q=${encodeURIComponent([studio.value.name, studio.value.address || studio.value.city].filter(Boolean).join(', '))}`,
)
</script>

<template>
  <div class="contents">
  <!-- ====================== MÓVIL ====================== -->
  <div class="flex flex-1 flex-col lg:hidden">
    <!-- HERO con vídeo de fondo -->
    <section class="relative -mb-2 overflow-hidden">
      <video
        class="absolute inset-0 size-full object-cover"
        :src="heroVideo"
        autoplay
        muted
        loop
        playsinline
        preload="auto"
        aria-hidden="true"
      />
      <!-- velo oscuro forest para integrar con la marca -->
      <div
        class="absolute inset-0"
        style="background: linear-gradient(180deg, color-mix(in oklab, var(--jdvm-bg-0) 55%, transparent) 0%, color-mix(in oklab, var(--jdvm-bg-0) 60%, transparent) 45%, var(--jdvm-bg-0) 100%)"
      />
      <UiGrain :opacity="0.25" />

      <div class="relative flex min-h-[19rem] flex-col">
        <!-- header -->
        <header class="flex items-center justify-between px-5 pt-4 pb-3">
          <AppLogo variant="mark" :size="22" />
          <div class="flex items-center gap-3">
            <NuxtLink to="/avisos" class="relative" aria-label="Avisos">
              <UIcon name="i-lucide-bell" class="text-default size-5" />
              <span v-if="unreadMine || alerts.length" class="bg-primary ring-default absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2" />
            </NuxtLink>
            <NuxtLink
              to="/perfil"
              class="bg-elevated/80 border-default flex size-9 items-center justify-center rounded-full border text-xs font-semibold backdrop-blur"
            >
              {{ avatarInitials }}
            </NuxtLink>
          </div>
        </header>

        <!-- saludo sobre el vídeo -->
        <div class="mt-auto px-5 pb-5">
          <p class="text-primary font-mono text-[0.65rem] tracking-[0.15em] uppercase">{{ today }}</p>
          <h1 class="font-display mt-1.5 text-4xl leading-none drop-shadow-lg">Buenas, {{ firstName }}.</h1>
        </div>
      </div>
    </section>

    <div class="mx-auto w-full max-w-6xl flex-1 space-y-6 px-5 pb-6 pt-3 lg:px-8 lg:pt-6">
      <!-- noticias destacadas -->
      <NuxtLink
        v-if="alerts.length"
        to="/avisos"
        class="border-primary/30 bg-primary/5 flex items-center gap-3 rounded-2xl border p-3.5"
      >
        <UIcon name="i-lucide-megaphone" class="text-primary size-5 shrink-0" />
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-semibold">{{ alerts[0]!.title }}</p>
          <p v-if="alerts[0]!.body" class="text-muted truncate text-xs">{{ alerts[0]!.body }}</p>
        </div>
        <UIcon name="i-lucide-chevron-right" class="text-primary size-4 shrink-0" />
      </NuxtLink>

      <div class="grid gap-6 lg:grid-cols-2 lg:items-start">
        <!-- columna izquierda -->
        <div class="space-y-6">
          <!-- próxima cita -->
      <section v-if="next" class="border-default bg-muted relative overflow-hidden rounded-2xl border">
        <span class="bg-primary absolute top-0 left-0 h-full w-[3px]" />
        <div class="space-y-4 p-5 pl-6">
          <div class="flex items-center justify-between">
            <span class="text-primary flex items-center gap-2 font-mono text-[0.6rem] tracking-widest uppercase">
              <span class="bg-primary size-1.5 rounded-full" />Próxima cita
            </span>
            <span class="text-dimmed font-mono text-[0.65rem]">{{ daysUntil(next.startsAt) }}</span>
          </div>
          <div class="flex items-end justify-between">
            <div>
              <p class="font-display text-4xl leading-none capitalize">{{ fmtDate(next.startsAt, 'EEE d') }}</p>
              <p class="text-primary font-display mt-1 text-2xl leading-none">{{ fmtDate(next.startsAt, 'HH:mm') }}</p>
            </div>
            <div class="bg-elevated border-default flex size-11 items-center justify-center rounded-full border text-sm font-semibold">
              {{ next.barberInitials }}
            </div>
          </div>
          <div class="border-default flex items-center gap-3 border-t pt-4">
            <div class="bg-primary/15 flex size-8 items-center justify-center rounded-lg">
              <UIcon name="i-lucide-scissors" class="text-primary size-4" />
            </div>
            <div class="flex-1">
              <p class="text-sm font-semibold">{{ next.serviceName }}</p>
              <p class="text-muted text-xs">con {{ next.barberName }}</p>
            </div>
            <p class="font-display text-xl">{{ formatPrice(next.price) }}</p>
          </div>
        </div>
        <NuxtLink
          :to="`/citas/${next.id}`"
          class="border-default text-muted hover:text-default flex items-center justify-center gap-1.5 border-t py-3 text-xs font-semibold"
        >
          Ver detalles o cancelar <UIcon name="i-lucide-chevron-right" class="size-3.5" />
        </NuxtLink>
      </section>

      <UiEmptyState
        v-else
        icon="i-lucide-calendar-x"
        title="Sin citas próximas"
        description="Cuando reserves una cita aparecerá aquí."
      />

          <!-- CTA -->
          <UButton to="/reservar" color="primary" size="lg" block icon="i-lucide-scissors">
            Reservar nueva cita
          </UButton>
        </div>

        <!-- columna derecha -->
        <div class="space-y-6">
          <!-- del estudio -->
      <section>
        <div class="mb-3 flex items-baseline justify-between">
          <h2 class="font-display text-xl">Del estudio</h2>
          <NuxtLink to="/estudio" class="text-primary flex items-center gap-1 text-xs font-semibold">
            Ver todo <UIcon name="i-lucide-chevron-right" class="size-3" />
          </NuxtLink>
        </div>
        <div class="grid grid-cols-[1.3fr_1fr] gap-2">
          <UiPhoto :src="gallery[0]?.url" :label="gallery[0]?.caption || 'estudio'" :height="150" :radius="14" />
          <div class="grid grid-rows-2 gap-2">
            <UiPhoto :src="gallery[1]?.url" :label="gallery[1]?.caption || 'estudio'" :height="71" :radius="14" />
            <UiPhoto :src="gallery[2]?.url" :label="gallery[2]?.caption || 'estudio'" :height="71" :radius="14" />
          </div>
        </div>
      </section>

      <!-- historial -->
      <section v-if="past.length" class="border-default overflow-hidden rounded-2xl border">
        <div class="bg-muted flex items-center gap-2 px-4 py-3.5">
          <UIcon name="i-lucide-clock" class="text-muted size-4" />
          <span class="text-sm font-semibold">Historial</span>
          <span class="bg-elevated text-dimmed rounded px-1.5 py-0.5 font-mono text-[0.6rem]">{{ past.length }}</span>
        </div>
        <div
          v-for="a in past.slice(0, 3)"
          :key="a.id"
          class="border-default flex items-center gap-3 border-t px-4 py-3"
        >
          <div class="bg-elevated border-default flex size-9 items-center justify-center rounded-full border text-xs font-semibold">
            {{ a.barberInitials }}
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold">{{ a.serviceName }}</p>
            <p class="text-dimmed text-xs capitalize">{{ fmtDate(a.startsAt, 'd MMM') }} · {{ a.barberName }}</p>
          </div>
          <span class="text-success flex items-center gap-1 text-xs font-semibold">
            <UIcon name="i-lucide-check" class="size-3.5" />Hecha
          </span>
        </div>
      </section>
        </div>
      </div>
    </div>
  </div>

  <!-- ====================== ESCRITORIO ====================== -->
  <div class="mx-auto hidden w-full max-w-[1280px] flex-1 flex-col px-8 py-10 lg:flex">
    <!-- saludo -->
    <div class="mb-7">
      <p class="text-dimmed font-mono text-[0.7rem] tracking-[0.15em] uppercase">{{ today }}</p>
      <h1 class="font-display mt-2 text-5xl leading-none">Buenas, {{ firstName }}.</h1>
    </div>

    <!-- noticia destacada -->
    <NuxtLink
      v-if="alerts.length"
      to="/avisos"
      class="border-primary/30 bg-primary/5 mb-7 flex items-center gap-3 rounded-2xl border px-5 py-4"
    >
      <UIcon name="i-lucide-megaphone" class="text-primary size-5 shrink-0" />
      <div class="min-w-0 flex-1">
        <p class="truncate text-sm font-semibold">{{ alerts[0]!.title }}</p>
        <p v-if="alerts[0]!.body" class="text-muted truncate text-xs">{{ alerts[0]!.body }}</p>
      </div>
      <UIcon name="i-lucide-chevron-right" class="text-primary size-4 shrink-0" />
    </NuxtLink>

    <!-- próxima cita hero -->
    <section
      v-if="next"
      class="border-default bg-muted mb-7 flex overflow-hidden rounded-[20px] border"
    >
      <span class="bg-primary w-1 shrink-0" />
      <div class="flex flex-1 items-center gap-10 px-8 py-7">
        <div>
          <div class="text-primary mb-3.5 flex items-center gap-2 font-mono text-[0.65rem] tracking-widest uppercase">
            <span class="bg-primary size-1.5 rounded-full" />Próxima cita · {{ daysUntil(next.startsAt) }}
          </div>
          <div class="flex items-end gap-4">
            <span class="font-display text-6xl leading-[0.85] capitalize">{{ fmtDate(next.startsAt, 'EEE d') }}</span>
            <span class="text-primary font-display text-3xl leading-tight">{{ fmtDate(next.startsAt, 'HH:mm') }}</span>
          </div>
        </div>
        <div class="bg-border h-24 w-px" />
        <div class="flex items-center gap-4">
          <div class="border-primary/40 bg-elevated flex size-14 items-center justify-center rounded-full border text-base font-semibold">
            {{ next.barberInitials }}
          </div>
          <div>
            <p class="text-lg font-semibold">{{ next.serviceName }}</p>
            <p class="text-muted mt-0.5 text-sm">con {{ next.barberName }}</p>
            <div class="mt-3 flex gap-4">
              <span class="text-dimmed flex items-center gap-1.5 text-xs">
                <UIcon name="i-lucide-clock" class="size-3.5" />{{ formatDuration(next.serviceDuration) }}
              </span>
              <span class="text-dimmed flex items-center gap-1.5 text-xs">
                <UIcon name="i-lucide-map-pin" class="size-3.5" />{{ cityShort || studio.name }}
              </span>
            </div>
          </div>
        </div>
        <div class="flex-1" />
        <div class="flex flex-col items-end gap-3">
          <span class="font-display text-3xl">{{ formatPrice(next.price) }}</span>
          <div class="flex gap-2.5">
            <UButton :to="`/citas/${next.id}`" color="neutral" variant="outline" size="md">Reprogramar</UButton>
            <UButton :to="mapsUrl" target="_blank" color="primary" size="md" icon="i-lucide-navigation">Cómo llegar</UButton>
          </div>
        </div>
      </div>
    </section>

    <UiEmptyState
      v-else
      class="mb-7"
      icon="i-lucide-calendar-x"
      title="Sin citas próximas"
      description="Cuando reserves una cita aparecerá aquí."
    />

    <!-- acciones rápidas -->
    <div class="mb-9 grid grid-cols-3 gap-4">
      <NuxtLink
        to="/reservar"
        class="bg-primary border-primary flex items-center gap-4 rounded-2xl border px-6 py-5"
      >
        <div class="flex size-11 shrink-0 items-center justify-center rounded-xl bg-black/15">
          <UIcon name="i-lucide-scissors" class="text-inverted size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-inverted text-[0.95rem] font-bold">Reservar nueva cita</p>
          <p class="text-[0.78rem] text-black/65">Elige servicio, barbero y hora</p>
        </div>
        <UIcon name="i-lucide-arrow-right" class="text-inverted size-[18px]" />
      </NuxtLink>

      <NuxtLink
        to="/reservar"
        class="border-default bg-muted hover:bg-elevated flex items-center gap-4 rounded-2xl border px-6 py-5 transition-colors"
      >
        <div class="bg-primary/15 flex size-11 shrink-0 items-center justify-center rounded-xl">
          <UIcon name="i-lucide-rotate-cw" class="text-primary size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[0.95rem] font-bold">{{ lastService ? `Repetir "${lastService.serviceName}"` : 'Repite tu corte' }}</p>
          <p class="text-dimmed text-[0.78rem]">{{ lastService ? `Con ${lastService.barberName} · el más rápido` : 'Reserva en dos toques' }}</p>
        </div>
        <UIcon name="i-lucide-arrow-right" class="text-dimmed size-[18px]" />
      </NuxtLink>

      <NuxtLink
        to="/lista-espera"
        class="border-default bg-muted hover:bg-elevated flex items-center gap-4 rounded-2xl border px-6 py-5 transition-colors"
      >
        <div class="bg-primary/15 flex size-11 shrink-0 items-center justify-center rounded-xl">
          <UIcon name="i-lucide-bell" class="text-primary size-5" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-[0.95rem] font-bold">Lista de espera</p>
          <p class="text-dimmed text-[0.78rem]">¿Sin tu hora ideal? Te avisamos</p>
        </div>
        <UIcon name="i-lucide-arrow-right" class="text-dimmed size-[18px]" />
      </NuxtLink>
    </div>

    <!-- historial + lateral -->
    <div class="grid grid-cols-[1.6fr_1fr] gap-6">
      <div>
        <div class="mb-3.5 flex items-baseline justify-between">
          <h2 class="font-display text-2xl">Historial</h2>
          <span class="text-dimmed font-mono text-xs">{{ past.length }} visitas</span>
        </div>
        <div v-if="past.length" class="border-default bg-muted overflow-hidden rounded-2xl border">
          <div
            v-for="(a, i) in past.slice(0, 5)"
            :key="a.id"
            class="flex items-center gap-4 px-5 py-4"
            :class="i ? 'border-default border-t' : ''"
          >
            <span class="text-dimmed w-14 shrink-0 font-mono text-xs capitalize">{{ fmtDate(a.startsAt, 'd MMM') }}</span>
            <div class="bg-elevated border-default flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">
              {{ a.barberInitials }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">{{ a.serviceName }}</p>
              <p class="text-dimmed truncate text-xs">{{ a.barberName }}</p>
            </div>
            <span class="text-success flex items-center gap-1.5 text-xs font-semibold">
              <UIcon name="i-lucide-check" class="size-3.5" />Hecha
            </span>
            <span class="font-display w-12 text-right text-lg">{{ formatPrice(a.price) }}</span>
            <UButton to="/reservar" color="neutral" variant="outline" size="sm">Repetir</UButton>
          </div>
        </div>
        <UiEmptyState
          v-else
          icon="i-lucide-history"
          title="Aún sin historial"
          description="Tus visitas anteriores aparecerán aquí."
        />
      </div>

      <div class="space-y-5">
        <!-- tarjeta socio (programa de fidelización; solo si está activo) -->
        <NuxtLink
          v-if="loyaltyEnabled"
          to="/socio"
          class="border-primary/30 block overflow-hidden rounded-[18px] border p-6"
          style="background: linear-gradient(135deg, var(--jdvm-bg-2), var(--jdvm-bg-1))"
        >
          <div class="mb-4 flex items-center justify-between">
            <AppLogo variant="mark" :size="17" />
            <span class="text-primary font-mono text-[0.6rem] tracking-widest uppercase">Socio · {{ mySummary.tier.name }}</span>
          </div>
          <p class="font-display text-4xl leading-none">{{ mySummary.balance }}</p>
          <p class="text-muted mt-1.5 text-xs">
            {{ mySummary.nextTier ? `puntos · ${mySummary.toNextTier} para ${mySummary.nextTier.name}` : 'puntos · nivel máximo' }}
          </p>
          <div class="bg-default mt-3.5 h-1.5 overflow-hidden rounded-full">
            <div class="bg-primary h-full rounded-full" :style="{ width: `${Math.round(mySummary.progress * 100)}%` }" />
          </div>
        </NuxtLink>

        <!-- del estudio -->
        <div>
          <div class="mb-3 flex items-baseline justify-between">
            <h2 class="font-display text-xl">Del estudio</h2>
            <NuxtLink to="/estudio" class="text-primary text-xs font-semibold">Ver galería</NuxtLink>
          </div>
          <div class="grid grid-cols-2 gap-2.5">
            <UiPhoto v-for="i in 4" :key="i" :src="gallery[i - 1]?.url" :label="gallery[i - 1]?.caption || 'estudio'" :height="104" :radius="12" />
          </div>
        </div>
      </div>
    </div>
  </div>
  </div>
</template>
