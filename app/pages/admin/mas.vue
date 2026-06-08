<script setup lang="ts">
definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Más · Admin' })

const { barbers } = useBarbers()
const { clients } = useClients()
const { signOut } = useAuth()

const config = computed(() => [
  { icon: 'i-lucide-user', label: 'Equipo', to: '/admin/equipo', badge: String(barbers.value.length || '') },
  { icon: 'i-lucide-users', label: 'Clientes', to: '/admin/clientes', badge: String(clients.value.length || '') },
  { icon: 'i-lucide-wallet', label: 'Facturación', to: '/admin/facturacion', badge: '' },
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
    <AdminHeader title="Más" sub="Gestión y configuración" />

    <div class="space-y-7 px-5 py-6 pb-24 lg:px-7">
      <!-- configuración -->
      <section>
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
