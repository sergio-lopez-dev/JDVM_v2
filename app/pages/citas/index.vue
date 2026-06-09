<script setup lang="ts">
import { fmtDate, formatPrice } from '~~/lib/format'

definePageMeta({ layout: 'inner', middleware: 'auth' })
useHead({ title: 'Mis citas' })

const { upcoming, past } = useMyAppointments()

interface StatusMeta { label: string; class: string; dot: string }
const STATUS_FALLBACK: StatusMeta = { label: 'Confirmada', class: 'bg-primary/10 border-primary/30 text-primary', dot: 'bg-primary' }
const STATUS: Record<string, StatusMeta> = {
  booked: STATUS_FALLBACK,
  completed: { label: 'Hecha', class: 'bg-success/10 border-success/30 text-success', dot: 'bg-success' },
  cancelled: { label: 'Cancelada', class: 'border-default text-dimmed', dot: 'bg-dimmed' },
  no_show: { label: 'No asististe', class: 'border-error/30 text-error', dot: 'bg-error' },
}
const statusOf = (s: string): StatusMeta => STATUS[s] ?? STATUS_FALLBACK
</script>

<template>
  <div class="mx-auto flex w-full max-w-3xl flex-1 flex-col">
    <AppBar title="Mis citas" />

    <div class="flex-1 space-y-7 px-5 py-4">
      <!-- próximas -->
      <section>
        <h2 class="font-display mb-3 flex items-center gap-2 text-xl">
          <span class="bg-primary size-1.5 rounded-full" />Próximas
          <span class="text-dimmed font-mono text-sm">{{ upcoming.length }}</span>
        </h2>
        <div v-if="upcoming.length" class="space-y-2.5">
          <NuxtLink
            v-for="a in upcoming"
            :key="a.id"
            :to="`/citas/${a.id}`"
            class="border-default bg-muted hover:border-primary/40 flex items-center gap-3 rounded-2xl border p-4 transition-colors"
          >
            <div class="border-primary/40 bg-elevated flex size-11 shrink-0 items-center justify-center rounded-full border text-sm font-semibold">{{ a.barberInitials }}</div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold capitalize">{{ fmtDate(a.startsAt, "EEE d MMM · HH:mm") }}</p>
              <p class="text-dimmed truncate text-xs">{{ a.serviceName }} · {{ a.barberName }}</p>
            </div>
            <span class="font-display text-lg">{{ formatPrice(a.price) }}</span>
            <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4 shrink-0" />
          </NuxtLink>
        </div>
        <UiEmptyState v-else icon="i-lucide-calendar-x" title="Sin citas próximas" description="Cuando reserves una cita aparecerá aquí.">
          <UButton to="/reservar" color="primary" icon="i-lucide-scissors" class="mt-3">Reservar cita</UButton>
        </UiEmptyState>
      </section>

      <!-- anteriores -->
      <section v-if="past.length">
        <h2 class="font-display mb-3 flex items-center gap-2 text-xl">Anteriores <span class="text-dimmed font-mono text-sm">{{ past.length }}</span></h2>
        <div class="border-default overflow-hidden rounded-2xl border">
          <NuxtLink
            v-for="(a, i) in past"
            :key="a.id"
            :to="`/citas/${a.id}`"
            class="flex items-center gap-3 px-4 py-3"
            :class="i ? 'border-default border-t' : ''"
          >
            <div class="bg-elevated border-default flex size-9 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold">{{ a.barberInitials }}</div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">{{ a.serviceName }}</p>
              <p class="text-dimmed truncate text-xs capitalize">{{ fmtDate(a.startsAt, 'd MMM yyyy') }} · {{ a.barberName }}</p>
            </div>
            <span class="inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-[0.7rem] font-semibold" :class="statusOf(a.status).class">
              <span class="size-1.5 rounded-full" :class="statusOf(a.status).dot" />{{ statusOf(a.status).label }}
            </span>
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
