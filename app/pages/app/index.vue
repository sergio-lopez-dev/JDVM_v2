<script setup lang="ts">
import { fmtDate, formatPrice, initials } from '~~/lib/format'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Inicio · JDVM' })

const user = useCurrentUser()
const { client, needsProfile } = useCurrentClient()
const { next, past } = useMyAppointments()

watch(needsProfile, (v) => {
  if (v) navigateTo('/completar-perfil')
})

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
</script>

<template>
  <div class="flex flex-1 flex-col">
    <!-- header -->
    <header class="flex items-center justify-between px-5 pt-4 pb-3">
      <AppLogo variant="mark" :size="22" />
      <div class="flex items-center gap-3">
        <NuxtLink to="/avisos" class="relative" aria-label="Avisos">
          <UIcon name="i-lucide-bell" class="text-default size-5" />
          <span class="bg-primary ring-default absolute -top-0.5 -right-0.5 size-2 rounded-full ring-2" />
        </NuxtLink>
        <NuxtLink
          to="/perfil"
          class="bg-elevated border-default flex size-9 items-center justify-center rounded-full border text-xs font-semibold"
        >
          {{ avatarInitials }}
        </NuxtLink>
      </div>
    </header>

    <div class="flex-1 space-y-6 px-5 pb-6">
      <!-- saludo -->
      <div>
        <p class="text-dimmed font-mono text-[0.65rem] tracking-[0.15em] uppercase">{{ today }}</p>
        <h1 class="font-display mt-1.5 text-4xl leading-none">Buenas, {{ firstName }}.</h1>
      </div>

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

      <!-- del estudio -->
      <section>
        <div class="mb-3 flex items-baseline justify-between">
          <h2 class="font-display text-xl">Del estudio</h2>
          <NuxtLink to="/estudio" class="text-primary flex items-center gap-1 text-xs font-semibold">
            Ver todo <UIcon name="i-lucide-chevron-right" class="size-3" />
          </NuxtLink>
        </div>
        <div class="grid grid-cols-[1.3fr_1fr] gap-2">
          <UiPhoto label="corte · fade" :height="150" :radius="14" />
          <div class="grid grid-rows-2 gap-2">
            <UiPhoto label="barba" :height="71" :radius="14" />
            <UiPhoto label="textura" :height="71" :radius="14" />
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
</template>
