<script setup lang="ts">
import { initials } from '~~/lib/format'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Más · Admin' })

const { barbers } = useBarbers()
const { reviews } = useReviews()
const { clients } = useClients()
const { signOut } = useAuth()

function ratingOf(id: string) {
  const list = reviews.value.filter((r) => r.barberId === id)
  if (!list.length) return '—'
  return (list.reduce((s, r) => s + r.score, 0) / list.length).toFixed(1)
}

const config = computed(() => [
  { icon: 'i-lucide-user', label: 'Equipo', to: '/admin/equipo', badge: String(barbers.value.length || '') },
  { icon: 'i-lucide-users', label: 'Clientes', to: '/admin/clientes', badge: String(clients.value.length || '') },
  { icon: 'i-lucide-chart-column', label: 'Informes', to: '/admin/reports', badge: '' },
  { icon: 'i-lucide-image', label: 'Estudio', to: '/admin/estudio', badge: '' },
  { icon: 'i-lucide-award', label: 'Fidelización', to: '/admin/fidelizacion', badge: '' },
  { icon: 'i-lucide-bell', label: 'Avisos', to: '/admin/notificaciones', badge: '' },
  { icon: 'i-lucide-settings', label: 'Ajustes', to: '/admin/ajustes', badge: '' },
  { icon: 'i-lucide-smartphone', label: 'Ver la app', to: '/app', badge: '' },
])
</script>

<template>
  <div>
    <AdminHeader title="Más" sub="Equipo y configuración" />

    <div class="space-y-7 px-5 py-6 pb-24 lg:px-7">
      <!-- equipo -->
      <section>
        <div class="mb-3 flex items-baseline justify-between">
          <h2 class="font-display text-xl">Equipo</h2>
          <NuxtLink to="/admin/equipo" class="text-primary flex items-center gap-1 text-sm font-semibold">
            <UIcon name="i-lucide-plus" class="size-4" />Añadir
          </NuxtLink>
        </div>
        <div class="space-y-2.5">
          <NuxtLink
            v-for="b in barbers"
            :key="b.id"
            to="/admin/equipo"
            class="border-default bg-muted flex items-center gap-3 rounded-2xl border p-3.5"
          >
            <div class="relative">
              <div class="bg-elevated flex size-11 items-center justify-center rounded-full border text-xs font-semibold" :style="{ borderColor: b.color }">{{ initials(b.name) }}</div>
              <span class="absolute right-0 bottom-0 size-3 rounded-full border-2" :style="{ borderColor: 'var(--jdvm-bg-1)', background: b.active ? 'var(--jdvm-success)' : 'var(--jdvm-fg-2)' }" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold">{{ b.name }}</div>
              <div class="text-dimmed truncate text-xs">{{ b.servicesOffered?.length ?? 0 }} servicios · @{{ b.slug }}</div>
            </div>
            <div class="text-right">
              <div class="flex items-center justify-end gap-1">
                <UIcon name="i-lucide-star" class="text-primary size-3.5" />
                <span class="text-sm font-semibold">{{ ratingOf(b.id) }}</span>
              </div>
              <div class="text-dimmed mt-0.5 text-[0.7rem]">{{ reviews.filter((r) => r.barberId === b.id).length }} reseñas</div>
            </div>
          </NuxtLink>
        </div>
      </section>

      <!-- configuración -->
      <section>
        <h2 class="font-display mb-3 text-xl">Configuración</h2>
        <div class="border-default overflow-hidden rounded-2xl border">
          <NuxtLink
            v-for="(c, i) in config"
            :key="c.label"
            :to="c.to"
            class="flex items-center gap-3 px-4 py-3.5"
            :class="i ? 'border-default border-t' : ''"
          >
            <div class="bg-accented flex size-8 items-center justify-center rounded-lg">
              <UIcon :name="c.icon" class="text-primary size-4" />
            </div>
            <span class="flex-1 text-sm font-medium">{{ c.label }}</span>
            <span v-if="c.badge" class="text-primary bg-primary/15 border-primary/30 rounded-md border px-1.5 py-0.5 font-mono text-[0.6rem]">{{ c.badge }}</span>
            <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4" />
          </NuxtLink>
          <button type="button" class="border-default flex w-full items-center gap-3 border-t px-4 py-3.5 text-left" @click="signOut">
            <div class="bg-error/10 flex size-8 items-center justify-center rounded-lg">
              <UIcon name="i-lucide-log-out" class="text-error size-4" />
            </div>
            <span class="text-error flex-1 text-sm font-medium">Cerrar sesión</span>
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
