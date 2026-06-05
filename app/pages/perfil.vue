<script setup lang="ts">
import { initials, fmtDate } from '~~/lib/format'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Perfil · JDVM' })

const user = useCurrentUser()
const { client } = useCurrentClient()
const { signOut } = useAuth()

const name = computed(() => client.value?.name || user.value?.displayName || 'Cliente')
const memberSince = computed(() => {
  const c = client.value?.createdAt as unknown
  if (c && typeof (c as { toDate?: unknown }).toDate === 'function') {
    return fmtDate((c as { toDate: () => Date }).toDate(), 'yyyy')
  }
  return '2026'
})

const menu = [
  { icon: 'i-lucide-user', label: 'Mis datos', badge: '', to: '' },
  { icon: 'i-lucide-credit-card', label: 'Métodos de pago', badge: '', to: '' },
  { icon: 'i-lucide-bell', label: 'Notificaciones', badge: '', to: '/avisos' },
  { icon: 'i-lucide-heart', label: 'Barberos favoritos', badge: '', to: '' },
  { icon: 'i-lucide-gift', label: 'Invita y gana', badge: '5€', to: '' },
  { icon: 'i-lucide-message-circle', label: 'Ayuda y contacto', badge: '', to: '' },
]
</script>

<template>
  <div class="flex flex-1 flex-col">
    <header class="flex items-center justify-between px-5 pt-5 pb-2">
      <h1 class="font-display text-3xl">Perfil</h1>
      <UIcon name="i-lucide-sliders-horizontal" class="text-muted size-5" />
    </header>

    <div class="flex-1 space-y-5 px-5 py-4">
      <!-- identidad -->
      <div class="flex items-center gap-4">
        <div class="border-primary/40 bg-elevated flex size-16 items-center justify-center rounded-full border text-lg font-semibold">
          {{ initials(name) }}
        </div>
        <div class="flex-1">
          <p class="font-display text-2xl leading-none">{{ name }}</p>
          <p class="text-muted mt-1 text-xs">Miembro desde {{ memberSince }} · Maracena</p>
        </div>
      </div>

      <!-- tarjeta socio (placeholder · fidelización aplazada) -->
      <div class="border-primary/30 relative overflow-hidden rounded-2xl border p-5" style="background: linear-gradient(135deg, var(--jdvm-bg-2), var(--jdvm-bg-1))">
        <div class="mb-4 flex items-center justify-between">
          <AppLogo variant="mark" :size="18" />
          <span class="text-primary font-mono text-[0.6rem] tracking-widest uppercase">Socio · Oro</span>
        </div>
        <div class="flex items-end justify-between">
          <div>
            <p class="font-display text-4xl leading-none">340</p>
            <p class="text-muted mt-1 text-[0.7rem]">puntos · 60 para corte gratis</p>
          </div>
          <div class="text-right">
            <p class="text-primary font-display text-2xl leading-none">12</p>
            <p class="text-muted mt-0.5 text-[0.7rem]">cortes</p>
          </div>
        </div>
        <div class="bg-default mt-3.5 h-1.5 overflow-hidden rounded-full">
          <div class="bg-primary h-full rounded-full" style="width: 85%" />
        </div>
      </div>

      <!-- menú -->
      <div class="border-default overflow-hidden rounded-2xl border">
        <component
          :is="item.to ? 'NuxtLink' : 'div'"
          v-for="(item, i) in menu"
          :key="item.label"
          :to="item.to || undefined"
          class="flex items-center gap-3 px-4 py-3.5"
          :class="i ? 'border-default border-t' : ''"
        >
          <div class="bg-elevated flex size-8 items-center justify-center rounded-lg">
            <UIcon :name="item.icon" class="text-primary size-4" />
          </div>
          <span class="flex-1 text-sm font-medium">{{ item.label }}</span>
          <span
            v-if="item.badge"
            class="text-primary bg-primary/15 border-primary/30 rounded border px-1.5 py-0.5 font-mono text-[0.6rem]"
            >{{ item.badge }}</span
          >
          <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4" />
        </component>
      </div>

      <UButton color="error" variant="outline" size="lg" block icon="i-lucide-log-out" @click="signOut">
        Cerrar sesión
      </UButton>

      <p class="text-dimmed text-center font-mono text-[0.6rem]">JDVM · v0.1.0</p>
    </div>
  </div>
</template>
