<script setup lang="ts">
import { fmtDate } from '~~/lib/format'
import { toDate } from '~~/lib/datetime'
import type { NotificationType } from '~~/schemas'

definePageMeta({ layout: 'inner', middleware: 'auth' })
useHead({ title: 'Avisos' })

const { active: alerts } = useAlerts()
const { mine, unreadMine, markRead, remove } = useNotifications()

const TYPE_META: Record<NotificationType, { icon: string; color: string }> = {
  cita_cancelada: { icon: 'i-lucide-calendar-x', color: 'text-error' },
  cita_nueva: { icon: 'i-lucide-calendar-check', color: 'text-success' },
  recordatorio: { icon: 'i-lucide-bell', color: 'text-primary' },
  campania: { icon: 'i-lucide-scissors', color: 'text-primary' },
  aviso: { icon: 'i-lucide-info', color: 'text-info' },
}
const ALERT_ICON: Record<string, string> = {
  info: 'i-lucide-info',
  success: 'i-lucide-party-popper',
  warning: 'i-lucide-triangle-alert',
}

const sorted = computed(() =>
  [...mine.value].sort((a, b) => {
    const ta = a.createdAt ? toDate(a.createdAt).getTime() : 0
    const tb = b.createdAt ? toDate(b.createdAt).getTime() : 0
    return tb - ta
  }),
)

async function markAll() {
  await Promise.all(mine.value.filter((n) => !n.read).map((n) => markRead(n.id)))
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <AppBar title="Avisos">
      <template #right>
        <button v-if="unreadMine" type="button" class="text-primary text-xs font-semibold" @click="markAll">Leer</button>
      </template>
    </AppBar>

    <div class="flex-1 space-y-6 px-5 py-3 pb-8">
      <!-- noticias destacadas (alerts) -->
      <section v-if="alerts.length">
        <p class="text-dimmed mb-2.5 font-mono text-[0.6rem] tracking-widest uppercase">Novedades del estudio</p>
        <div class="space-y-2.5">
          <div v-for="a in alerts" :key="a.id" class="border-primary/30 bg-primary/5 flex gap-3 rounded-xl border p-3.5">
            <UIcon :name="ALERT_ICON[a.level] ?? 'i-lucide-info'" class="text-primary mt-0.5 size-5 shrink-0" />
            <div>
              <p class="text-sm font-semibold">{{ a.title }}</p>
              <p v-if="a.body" class="text-muted mt-0.5 text-sm">{{ a.body }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- notificaciones personales -->
      <section>
        <p class="text-dimmed mb-2.5 font-mono text-[0.6rem] tracking-widest uppercase">Tus avisos</p>
        <div v-if="sorted.length" class="space-y-2.5">
          <div
            v-for="n in sorted"
            :key="n.id"
            class="flex gap-3 rounded-xl border p-3.5"
            :class="!n.read ? 'bg-muted border-default' : 'border-default/60'"
            @click="!n.read && markRead(n.id)"
          >
            <div class="bg-elevated flex size-9 shrink-0 items-center justify-center rounded-lg">
              <UIcon :name="(TYPE_META[n.type] ?? TYPE_META.aviso).icon" class="size-4" :class="(TYPE_META[n.type] ?? TYPE_META.aviso).color" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="text-sm font-semibold">{{ n.title }}</p>
                <span v-if="!n.read" class="bg-primary size-1.5 shrink-0 rounded-full" />
              </div>
              <p v-if="n.body" class="text-muted mt-0.5 text-sm leading-snug">{{ n.body }}</p>
              <p v-if="n.createdAt" class="text-dimmed mt-1 font-mono text-[0.6rem]">{{ fmtDate(toDate(n.createdAt), 'd MMM · HH:mm') }}</p>
            </div>
            <button type="button" class="text-dimmed hover:text-error flex size-7 shrink-0 items-center justify-center" aria-label="Eliminar" @click.stop="remove(n.id)"><UIcon name="i-lucide-x" class="size-4" /></button>
          </div>
        </div>
        <UiEmptyState v-else icon="i-lucide-bell-off" title="Sin avisos" description="Aquí verás recordatorios y novedades de tus citas." />
      </section>
    </div>
  </div>
</template>
