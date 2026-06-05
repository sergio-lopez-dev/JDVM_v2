<script setup lang="ts">
definePageMeta({ layout: 'inner', middleware: 'auth' })
useHead({ title: 'Avisos · JDVM' })

// Estáticos por ahora (la colección de notificaciones se cablea en la Fase 5 con FCM).
const groups = [
  {
    title: 'Hoy',
    items: [
      { icon: 'i-lucide-bell', h: 'Recordatorio de cita', body: 'Mañana a las 17:30 con Dani. ¡Te esperamos!', when: '2 h', unread: true },
      { icon: 'i-lucide-gift', h: '+20 puntos añadidos', body: 'Por tu última visita. Ya tienes 340 puntos.', when: '5 h', unread: true },
    ],
  },
  {
    title: 'Esta semana',
    items: [
      { icon: 'i-lucide-circle-check', h: 'Cita confirmada', body: 'Corte + barba · jueves 4 jun, 17:30.', when: 'Lun', unread: false },
      { icon: 'i-lucide-tag', h: 'Martes de barba -20%', body: 'Arreglo de barba rebajado todos los martes.', when: 'Lun', unread: false },
      { icon: 'i-lucide-scissors', h: '¿Qué tal tu corte?', body: 'Valora tu visita del 18 de mayo con Dani.', when: 'Dom', unread: false },
    ],
  },
]
</script>

<template>
  <div class="flex flex-1 flex-col">
    <AppBar title="Avisos">
      <template #right><span class="text-primary text-xs font-semibold">Leer</span></template>
    </AppBar>

    <div class="flex-1 space-y-5 px-5 py-3">
      <section v-for="g in groups" :key="g.title">
        <p class="text-dimmed mb-2.5 font-mono text-[0.6rem] tracking-widest uppercase">{{ g.title }}</p>
        <div class="space-y-2.5">
          <div
            v-for="(n, i) in g.items"
            :key="i"
            class="relative flex gap-3 rounded-xl border p-3.5"
            :class="n.unread ? 'bg-muted border-default' : 'border-default/60'"
          >
            <div
              class="flex size-9 shrink-0 items-center justify-center rounded-lg"
              :class="n.unread ? 'bg-primary/15' : 'bg-elevated'"
            >
              <UIcon :name="n.icon" class="size-4" :class="n.unread ? 'text-primary' : 'text-muted'" />
            </div>
            <div class="flex-1">
              <div class="flex items-baseline justify-between gap-2">
                <p class="text-sm font-semibold">{{ n.h }}</p>
                <span class="text-dimmed shrink-0 font-mono text-[0.6rem]">{{ n.when }}</span>
              </div>
              <p class="text-muted mt-0.5 text-xs leading-relaxed">{{ n.body }}</p>
            </div>
            <span v-if="n.unread" class="bg-primary absolute top-3.5 right-3 size-1.5 rounded-full" />
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
