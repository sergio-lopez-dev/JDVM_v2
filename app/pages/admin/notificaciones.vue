<script setup lang="ts">
import { fmtDate } from '~~/lib/format'
import { toDate } from '~~/lib/datetime'
import { ALERT_LEVELS, type AlertLevel } from '~~/schemas'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Avisos · Admin' })

const { alerts, create, update, remove } = useAlerts()
const { adminFeed, remove: removeNotif, campaign } = useNotifications()
const { inRange } = useAppointments()
const { name: studioName } = useStudio()
const toast = useToast()

// — Feed de actividad (cancelaciones, etc.) —
interface FeedMeta {
  icon: string
  class: string
}
const FEED_FALLBACK: FeedMeta = { icon: 'i-lucide-info', class: 'text-info' }
const FEED_META: Record<string, FeedMeta> = {
  cita_cancelada: { icon: 'i-lucide-calendar-x', class: 'text-error' },
  cita_nueva: { icon: 'i-lucide-calendar-plus', class: 'text-success' },
  recordatorio: { icon: 'i-lucide-clock', class: 'text-primary' },
  campania: { icon: 'i-lucide-megaphone', class: 'text-primary' },
  aviso: { icon: 'i-lucide-info', class: 'text-info' },
}
function feedMeta(type: string): FeedMeta {
  return FEED_META[type] ?? FEED_FALLBACK
}
async function delNotif(id: string) {
  await removeNotif(id)
}

// — Campaña "anima a reservar": clientes con 1–3 citas este mes —
const monthStart = computed(() => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth(), 1)
})
const monthEnd = computed(() => {
  const d = new Date()
  return new Date(d.getFullYear(), d.getMonth() + 1, 1)
})
const monthAppts = inRange(monthStart, monthEnd)
const reEngage = computed(() => {
  const counts = new Map<string, number>()
  for (const a of monthAppts.value) {
    if (a.status === 'booked' || a.status === 'completed') {
      counts.set(a.clientId, (counts.get(a.clientId) ?? 0) + 1)
    }
  }
  return [...counts.entries()].filter(([, n]) => n >= 1 && n <= 3).map(([uid]) => uid)
})
const campaignSending = ref(false)
async function sendCampaign() {
  if (!reEngage.value.length) {
    toast.add({ title: 'No hay clientes a los que avisar este mes', icon: 'i-lucide-info' })
    return
  }
  campaignSending.value = true
  try {
    await campaign(
      reEngage.value,
      '¿Te toca un repaso? ✂️',
      `Reserva tu próxima cita en ${studioName.value} y mantén tu estilo siempre a punto.`,
    )
    toast.add({ title: `Aviso enviado a ${reEngage.value.length} clientes`, icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toast.add({ title: 'No se pudo enviar', description: (e as Error).message, color: 'error' })
  } finally {
    campaignSending.value = false
  }
}

const LEVEL_META: Record<AlertLevel, { label: string; icon: string; class: string; dot: string }> = {
  info: { label: 'Info', icon: 'i-lucide-info', class: 'text-info bg-info/10 border-info/30', dot: 'bg-info' },
  success: { label: 'Buenas', icon: 'i-lucide-party-popper', class: 'text-success bg-success/10 border-success/30', dot: 'bg-success' },
  warning: { label: 'Aviso', icon: 'i-lucide-triangle-alert', class: 'text-warning bg-warning/10 border-warning/30', dot: 'bg-warning' },
}

const form = reactive({
  title: '',
  body: '',
  level: 'info' as AlertLevel,
  push: false,
})
const sending = ref(false)

const sorted = computed(() =>
  [...alerts.value].sort((a, b) => {
    const ta = a.createdAt ? toDate(a.createdAt).getTime() : 0
    const tb = b.createdAt ? toDate(b.createdAt).getTime() : 0
    return tb - ta
  }),
)

async function publish() {
  if (!form.title.trim()) {
    toast.add({ title: 'El título es obligatorio', color: 'error', icon: 'i-lucide-triangle-alert' })
    return
  }
  sending.value = true
  try {
    await create({
      title: form.title.trim(),
      body: form.body.trim(),
      level: form.level,
      active: true,
      push: form.push,
    })
    toast.add({
      title: form.push ? 'Aviso publicado (push se enviará en Fase 5)' : 'Aviso publicado',
      icon: 'i-lucide-check',
      color: 'success',
    })
    form.title = ''
    form.body = ''
    form.level = 'info'
    form.push = false
  } catch (e) {
    toast.add({ title: 'No se pudo publicar', description: (e as Error).message, color: 'error' })
  } finally {
    sending.value = false
  }
}

const toggleActive = (id: string, active: boolean) => update(id, { active: !active })
async function del(id: string) {
  if (!confirm('¿Eliminar este aviso?')) return
  await remove(id)
  toast.add({ title: 'Aviso eliminado', icon: 'i-lucide-trash-2' })
}
</script>

<template>
  <div>
    <AdminHeader title="Avisos" sub="Banners y notificaciones" />

    <div class="grid gap-6 px-5 py-6 pb-24 lg:grid-cols-[1fr_1.3fr] lg:px-7 lg:pb-6">
      <!-- composer -->
      <section class="border-default bg-muted h-fit rounded-2xl border p-5">
        <h2 class="font-display mb-4 text-xl">Nuevo aviso</h2>
        <div class="space-y-4">
          <UFormField label="Título"><UInput v-model="form.title" placeholder="Cerrado por festivo" class="w-full" /></UFormField>
          <UFormField label="Mensaje"><UTextarea v-model="form.body" :rows="3" placeholder="El estudio permanecerá cerrado el…" class="w-full" /></UFormField>

          <div>
            <p class="text-dimmed mb-2 font-mono text-[0.6rem] tracking-widest uppercase">Tipo</p>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="lvl in ALERT_LEVELS"
                :key="lvl"
                type="button"
                class="flex items-center justify-center gap-1.5 rounded-xl border py-2 text-sm font-medium"
                :class="form.level === lvl ? LEVEL_META[lvl].class : 'border-default bg-elevated text-muted'"
                @click="form.level = lvl"
              >
                <UIcon :name="LEVEL_META[lvl].icon" class="size-4" />{{ LEVEL_META[lvl].label }}
              </button>
            </div>
          </div>

          <div class="border-default bg-elevated flex items-center justify-between rounded-xl border p-3">
            <div class="flex items-center gap-2.5">
              <UIcon name="i-lucide-bell-ring" class="text-primary size-4" />
              <div>
                <p class="text-sm font-semibold">Enviar push</p>
                <p class="text-dimmed text-xs">Se integrará con FCM en la Fase 5</p>
              </div>
            </div>
            <USwitch v-model="form.push" />
          </div>

          <UButton color="primary" size="lg" block :loading="sending" icon="i-lucide-send" @click="publish">Publicar aviso</UButton>
        </div>
      </section>

      <!-- listado -->
      <section>
        <h2 class="font-display mb-4 text-xl">Avisos publicados</h2>
        <div v-if="sorted.length" class="space-y-3">
          <div
            v-for="a in sorted"
            :key="a.id"
            class="rounded-2xl border p-4"
            :class="a.active ? LEVEL_META[a.level].class : 'border-default bg-muted opacity-60'"
          >
            <div class="flex items-start gap-3">
              <UIcon :name="LEVEL_META[a.level].icon" class="mt-0.5 size-5 shrink-0" />
              <div class="min-w-0 flex-1">
                <p class="text-sm font-semibold">{{ a.title }}</p>
                <p v-if="a.body" class="text-muted mt-0.5 text-sm">{{ a.body }}</p>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <span v-if="a.createdAt" class="text-dimmed font-mono text-[0.6rem]">{{ fmtDate(toDate(a.createdAt), 'd MMM · HH:mm') }}</span>
                  <span v-if="a.push" class="text-primary bg-primary/15 inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-mono text-[0.55rem] uppercase"><UIcon name="i-lucide-bell-ring" class="size-3" />push</span>
                </div>
              </div>
              <div class="flex shrink-0 items-center gap-1">
                <USwitch :model-value="a.active" size="sm" @update:model-value="toggleActive(a.id, a.active)" />
                <button type="button" class="text-error/80 hover:text-error flex size-8 items-center justify-center" aria-label="Eliminar" @click="del(a.id)"><UIcon name="i-lucide-trash-2" class="size-4" /></button>
              </div>
            </div>
          </div>
        </div>
        <UiEmptyState v-else icon="i-lucide-bell-off" title="Sin avisos" description="Publica un aviso para mostrarlo como banner en la app." />
      </section>
    </div>

    <!-- campaña + feed -->
    <div class="grid gap-6 px-5 pb-24 lg:grid-cols-[1fr_1.3fr] lg:px-7 lg:pb-6">
      <!-- campaña reserva más -->
      <section class="border-primary/30 bg-primary/5 h-fit rounded-2xl border p-5">
        <div class="flex items-center gap-2.5">
          <UIcon name="i-lucide-megaphone" class="text-primary size-5" />
          <h2 class="font-display text-xl">Anima a reservar</h2>
        </div>
        <p class="text-muted mt-2 text-sm leading-relaxed">
          Envía un aviso a los clientes que han venido <strong>1–3 veces este mes</strong> para que reserven de nuevo.
        </p>
        <div class="mt-4 flex items-center gap-3">
          <div class="border-primary/30 bg-default rounded-xl border px-3.5 py-2">
            <span class="font-display text-2xl">{{ reEngage.length }}</span>
            <span class="text-dimmed ml-1 text-xs">clientes</span>
          </div>
          <UButton color="primary" :loading="campaignSending" :disabled="!reEngage.length" icon="i-lucide-send" class="flex-1 justify-center" @click="sendCampaign">Enviar aviso</UButton>
        </div>
      </section>

      <!-- feed de actividad -->
      <section>
        <h2 class="font-display mb-4 text-xl">Actividad reciente</h2>
        <div v-if="adminFeed.length" class="space-y-2.5">
          <div v-for="n in adminFeed" :key="n.id" class="border-default bg-muted flex items-start gap-3 rounded-2xl border p-4">
            <UIcon :name="feedMeta(n.type).icon" class="mt-0.5 size-5 shrink-0" :class="feedMeta(n.type).class" />
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">{{ n.title }}</p>
              <p v-if="n.body" class="text-muted mt-0.5 text-sm">{{ n.body }}</p>
              <p v-if="n.createdAt" class="text-dimmed mt-1.5 font-mono text-[0.6rem]">{{ fmtDate(toDate(n.createdAt), 'd MMM · HH:mm') }}</p>
            </div>
            <button type="button" class="text-dimmed hover:text-error flex size-8 items-center justify-center" aria-label="Eliminar" @click="delNotif(n.id)"><UIcon name="i-lucide-x" class="size-4" /></button>
          </div>
        </div>
        <UiEmptyState v-else icon="i-lucide-inbox" title="Sin actividad" description="Aquí verás cancelaciones y otros avisos del sistema." />
      </section>
    </div>
  </div>
</template>
