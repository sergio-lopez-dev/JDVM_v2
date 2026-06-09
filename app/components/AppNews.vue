<script setup lang="ts">
import type { Alert } from '~~/schemas'

// Noticias destacadas del estudio para el cliente (colección `alerts`). Recupera
// la idea del legacy ("Noticias destacadas"): muestra TODAS las activas, no solo
// la última. Se oculta si no hay ninguna.
const { active: alerts } = useAlerts()

const LEVEL: Record<Alert['level'], { icon: string; ring: string; bg: string; fg: string }> = {
  info: { icon: 'i-lucide-megaphone', ring: 'border-primary/30', bg: 'bg-primary/5', fg: 'text-primary' },
  success: { icon: 'i-lucide-party-popper', ring: 'border-success/30', bg: 'bg-success/5', fg: 'text-success' },
  warning: { icon: 'i-lucide-triangle-alert', ring: 'border-warning/30', bg: 'bg-warning/5', fg: 'text-warning' },
}
const styleOf = (a: Alert) => LEVEL[a.level] ?? LEVEL.info
</script>

<template>
  <section v-if="alerts.length" class="space-y-2.5">
    <div class="flex items-baseline justify-between">
      <h2 class="font-display flex items-center gap-2 text-xl">
        <UIcon name="i-lucide-megaphone" class="text-primary size-5" />Noticias destacadas
      </h2>
      <NuxtLink v-if="alerts.length > 2" to="/avisos" class="text-primary text-xs font-semibold">Ver todas</NuxtLink>
    </div>
    <div class="space-y-2.5">
      <div
        v-for="a in alerts.slice(0, 4)"
        :key="a.id"
        class="flex items-start gap-3 rounded-2xl border p-3.5"
        :class="[styleOf(a).ring, styleOf(a).bg]"
      >
        <UIcon :name="styleOf(a).icon" class="mt-0.5 size-5 shrink-0" :class="styleOf(a).fg" />
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold">{{ a.title }}</p>
          <p v-if="a.body" class="text-muted mt-0.5 text-xs leading-relaxed">{{ a.body }}</p>
        </div>
      </div>
    </div>
  </section>
</template>
