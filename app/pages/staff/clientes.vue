<script setup lang="ts">
import { initials } from '~~/lib/format'

definePageMeta({ layout: 'barber', middleware: 'barber' })
useHead({ title: 'Mis clientes · Barbero' })

const toast = useToast()
const { enriched } = useBarber()

const search = ref('')
const onlyFav = ref(false)

function relative(d: Date) {
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000)
  if (days <= 0) return 'Hoy'
  if (days === 1) return 'Ayer'
  if (days < 7) return `Hace ${days} días`
  if (days < 30) return `Hace ${Math.floor(days / 7)} sem`
  if (days < 365) return `Hace ${Math.floor(days / 30)} mes${Math.floor(days / 30) > 1 ? 'es' : ''}`
  return `Hace ${Math.floor(days / 365)} año${Math.floor(days / 365) > 1 ? 's' : ''}`
}

interface Cli {
  id: string
  name: string
  phone?: string
  count: number
  last: Date
  topService: string
  fav: boolean
}
const clients = computed<Cli[]>(() => {
  const map = new Map<string, { id: string; name: string; phone?: string; count: number; last: Date; svc: Map<string, number> }>()
  for (const a of enriched.value) {
    if (a.status === 'cancelled') continue
    let cur = map.get(a.clientId)
    if (!cur) {
      cur = { id: a.clientId, name: a.clientName, phone: a.clientPhone, count: 0, last: a.startsAt, svc: new Map() }
      map.set(a.clientId, cur)
    }
    cur.count += 1
    if (a.startsAt > cur.last) cur.last = a.startsAt
    cur.svc.set(a.serviceName, (cur.svc.get(a.serviceName) ?? 0) + 1)
  }
  return [...map.values()]
    .map((c) => ({
      id: c.id,
      name: c.name,
      phone: c.phone,
      count: c.count,
      last: c.last,
      topService: [...c.svc.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—',
      fav: c.count >= 10,
    }))
    .sort((a, b) => b.last.getTime() - a.last.getTime())
})
const filtered = computed(() => {
  const q = search.value.trim().toLowerCase()
  return clients.value
    .filter((c) => (onlyFav.value ? c.fav : true))
    .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
})

function noCreate() {
  toast.add({ title: 'Nueva cita', description: 'Las reservas las gestiona el administrador.', icon: 'i-lucide-info' })
}
</script>

<template>
  <div>
    <!-- ░░░ MÓVIL ░░░ -->
    <div class="flex flex-1 flex-col lg:hidden">
      <header class="px-5 pt-5 pb-2">
        <h1 class="font-display text-3xl">Mis clientes</h1>
        <p class="text-dimmed mt-1 text-xs">{{ clients.length }} clientes te eligen a ti</p>
      </header>
      <div class="px-5 pb-3"><UInput v-model="search" placeholder="Buscar cliente…" icon="i-lucide-search" size="lg" class="w-full" /></div>
      <div class="flex-1 space-y-2.5 px-5 pb-6">
        <div v-for="c in filtered" :key="c.id" class="border-default bg-muted flex items-center gap-3 rounded-2xl border p-3.5">
          <div class="border-primary/40 bg-elevated flex size-11 items-center justify-center rounded-full border text-sm font-semibold">{{ initials(c.name) }}</div>
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5"><span class="truncate text-sm font-semibold">{{ c.name }}</span><UIcon v-if="c.fav" name="i-lucide-star" class="text-primary size-3.5 shrink-0" /></div>
            <div class="text-dimmed truncate text-xs">Última: {{ relative(c.last) }} · {{ c.count }} visitas</div>
          </div>
          <div class="flex gap-2">
            <a :href="c.phone ? `tel:${c.phone}` : undefined" class="border-default bg-accented text-toned flex size-9 items-center justify-center rounded-[10px] border" :class="!c.phone ? 'pointer-events-none opacity-50' : ''" aria-label="Llamar"><UIcon name="i-lucide-message-circle" class="size-4" /></a>
            <button type="button" class="border-primary/30 bg-primary/10 text-primary flex size-9 items-center justify-center rounded-[10px] border" aria-label="Nueva cita" @click="noCreate"><UIcon name="i-lucide-plus" class="size-4" /></button>
          </div>
        </div>
        <UiEmptyState v-if="!filtered.length" icon="i-lucide-users" title="Sin clientes" description="Aún no tienes clientes con citas." />
      </div>
    </div>

    <!-- ░░░ ESCRITORIO ░░░ -->
    <div class="hidden lg:block">
      <AdminHeader v-model:search="search" title="Mis clientes" :sub="`${clients.length} clientes te eligen a ti`" show-search search-placeholder="Buscar entre mis clientes…">
        <template #actions>
          <UButton :color="onlyFav ? 'primary' : 'neutral'" :variant="onlyFav ? 'solid' : 'soft'" icon="i-lucide-star" @click="onlyFav = !onlyFav">Habituales</UButton>
        </template>
      </AdminHeader>

      <div class="px-7 py-6">
        <AdminCard :pad="false">
          <div class="bg-accented border-default text-dimmed grid grid-cols-[2fr_1.2fr_0.8fr_1.5fr_60px] gap-3 border-b px-5 py-3 font-mono text-[0.6rem] tracking-widest uppercase">
            <span>Cliente</span><span>Última visita</span><span>Visitas</span><span>Servicio habitual</span><span>Llamar</span>
          </div>
          <div v-for="c in filtered" :key="c.id" class="border-default grid grid-cols-[2fr_1.2fr_0.8fr_1.5fr_60px] items-center gap-3 border-b px-5 py-3 last:border-b-0">
            <div class="flex min-w-0 items-center gap-3">
              <div class="bg-elevated border-default flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">{{ initials(c.name) }}</div>
              <span class="flex items-center gap-1.5 truncate text-sm font-semibold">{{ c.name }}<UIcon v-if="c.fav" name="i-lucide-star" class="text-primary size-3" /></span>
            </div>
            <span class="text-toned text-sm">{{ relative(c.last) }}</span>
            <span class="font-display text-lg">{{ c.count }}</span>
            <span class="text-toned truncate text-sm">{{ c.topService }}</span>
            <a :href="c.phone ? `tel:${c.phone}` : undefined" class="border-default bg-muted hover:bg-elevated text-toned flex size-9 items-center justify-center justify-self-end rounded-[10px] border" :class="!c.phone ? 'pointer-events-none opacity-40' : ''" aria-label="Llamar"><UIcon name="i-lucide-phone" class="size-4" /></a>
          </div>
          <div v-if="!filtered.length" class="p-10"><UiEmptyState icon="i-lucide-users" title="Sin clientes" description="Aún no tienes clientes con citas." /></div>
        </AdminCard>
      </div>
    </div>
  </div>
</template>
