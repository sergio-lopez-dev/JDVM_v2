<script setup lang="ts">
import { fmtDate, formatPrice, initials, dayLetterEs } from '~~/lib/format'
import { sameDay } from '~~/lib/datetime'

definePageMeta({ layout: 'barber', middleware: 'barber' })
useHead({ title: 'Mi día · Barbero' })

const user = useCurrentUser()
const toast = useToast()
const { setStatus } = useAppointments()
const { today, enriched, me, rating, onDay, isNow, now } = useBarber()

// Los bloqueos de hueco no son citas: fuera de "Mi día" (stats, "en curso", lista).
const dayItems = onDay(today)
const list = computed(() => dayItems.value.filter((a) => a.type !== 'block'))
const firstName = computed(() => (me.value?.name || user.value?.displayName || 'barbero').split(' ')[0])

// Tu parte = servicios·comisión + propinas (100%). El barbero NUNCA ve el bruto
// de la barbería: solo lo que le toca a él (igual que /staff/ingresos).
const pct = computed(() => me.value?.commissionPercent ?? 50)
const myShare = (a: { price: number; tip?: number }) =>
  (a.price * pct.value) / 100 + (a.tip ?? 0)

const current = computed(() => list.value.find((a) => isNow(a)) ?? null)
const remaining = computed(() =>
  current.value ? Math.max(0, Math.ceil((current.value.endsAt.getTime() - now.value.getTime()) / 60_000)) : 0,
)
const stats = computed(() => {
  const done = list.value.filter((a) => a.status === 'completed')
  return {
    count: list.value.length,
    done: done.length,
    earned: done.reduce((s, a) => s + myShare(a), 0),
    rating: rating.value ? rating.value.toFixed(1).replace('.', ',') : '—',
  }
})

// Ingresos de la semana (barras).
function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const week = computed(() => {
  const s = startOfWeek(today.value)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(s)
    day.setDate(day.getDate() + i)
    const val = enriched.value
      .filter((a) => a.status === 'completed' && sameDay(a.startsAt, day))
      .reduce((sum, a) => sum + myShare(a), 0)
    return { letter: dayLetterEs(day), val }
  })
})
const weekTotal = computed(() => week.value.reduce((s, d) => s + d.val, 0))
const maxWeek = computed(() => Math.max(1, ...week.value.map((d) => d.val)))

function pillKind(s: string) {
  return s === 'completed' ? 'done' : s === 'no_show' ? 'cancelled' : 'confirmed'
}
async function markDone(id: string) {
  // Por defecto se cobra en efectivo; el método se ajusta luego en el detalle.
  await setStatus(id, 'completed', { paymentMethod: 'cash' })
  toast.add({ title: 'Cita marcada como hecha', icon: 'i-lucide-check', color: 'success' })
}
</script>

<template>
  <div>
    <!-- ░░░ MÓVIL ░░░ -->
    <div class="flex flex-1 flex-col lg:hidden">
      <header class="flex items-center gap-3 px-5 pt-4 pb-3">
        <div class="border-primary/40 bg-elevated flex size-11 items-center justify-center rounded-full border text-sm font-semibold">{{ initials(me?.name || firstName) }}</div>
        <div class="flex-1">
          <p class="text-dimmed font-mono text-[0.6rem] tracking-[0.15em] uppercase">{{ fmtDate(today, 'EEEE d MMM') }}</p>
          <h1 class="font-display text-2xl leading-tight">Hola, {{ firstName }}</h1>
        </div>
        <NuxtLink to="/avisos" class="border-default bg-muted relative flex size-10 items-center justify-center rounded-xl border" aria-label="Avisos">
          <UIcon name="i-lucide-bell" class="text-toned size-[18px]" />
          <span class="bg-primary ring-muted absolute top-2 right-2 size-[7px] rounded-full ring-2" />
        </NuxtLink>
      </header>

      <div class="flex-1 space-y-5 px-5 pb-6">
        <div class="grid grid-cols-4 gap-2.5">
          <div class="border-default bg-muted rounded-xl border p-3"><div class="font-display text-2xl leading-none">{{ stats.count }}</div><div class="text-dimmed mt-1.5 text-[0.65rem]">Citas hoy</div></div>
          <div class="border-default bg-muted rounded-xl border p-3"><div class="font-display text-2xl leading-none">{{ stats.done }}</div><div class="text-dimmed mt-1.5 text-[0.65rem]">Hechas</div></div>
          <div class="border-default bg-muted rounded-xl border p-3"><div class="font-display text-primary text-2xl leading-none">{{ formatPrice(stats.earned) }}</div><div class="text-dimmed mt-1.5 text-[0.65rem]">Ganado</div></div>
          <div class="border-default bg-muted rounded-xl border p-3"><div class="font-display text-2xl leading-none">{{ stats.rating }}</div><div class="text-dimmed mt-1.5 text-[0.65rem]">★ Hoy</div></div>
        </div>

        <section v-if="current" class="border-primary/30 bg-muted overflow-hidden rounded-2xl border">
          <div class="p-4">
            <div class="mb-3.5 flex items-center gap-2">
              <span class="bg-primary size-1.5 rounded-full" style="box-shadow: 0 0 0 3px var(--jdvm-accent-soft)" />
              <span class="text-primary font-mono text-[0.6rem] tracking-[0.15em] uppercase">En curso ahora</span>
              <span class="text-dimmed ml-auto font-mono text-[0.7rem]">quedan {{ remaining }} min</span>
            </div>
            <div class="flex items-center gap-3">
              <div class="border-primary/40 bg-elevated flex size-12 items-center justify-center rounded-full border text-sm font-semibold">{{ initials(current.clientName) }}</div>
              <div class="min-w-0 flex-1"><div class="truncate text-base font-semibold">{{ current.clientName }}</div><div class="text-toned truncate text-sm">{{ current.serviceName }} · {{ fmtDate(current.startsAt, 'HH:mm') }}</div></div>
              <div class="font-display text-2xl">{{ formatPrice(current.price) }}</div>
            </div>
          </div>
          <div class="border-default flex border-t">
            <a :href="current.clientPhone ? `tel:${current.clientPhone}` : undefined" class="border-default text-toned flex flex-1 items-center justify-center gap-2 border-r py-3 text-sm font-semibold" :class="!current.clientPhone ? 'pointer-events-none opacity-50' : ''"><UIcon name="i-lucide-phone" class="size-4" />Llamar</a>
            <button type="button" class="bg-primary text-inverted flex flex-[1.4] items-center justify-center gap-2 py-3 text-sm font-bold" @click="markDone(current.id)"><UIcon name="i-lucide-check" class="size-4" />Marcar hecha</button>
          </div>
        </section>

        <section>
          <h2 class="font-display mb-3 text-xl">Mi día</h2>
          <div v-if="list.length" class="border-default overflow-hidden rounded-2xl border">
            <NuxtLink v-for="(a, i) in list" :key="a.id" :to="`/staff/cita/${a.id}`" class="flex items-center gap-3 px-4 py-3" :class="[i ? 'border-default border-t' : '', a.status === 'completed' ? 'opacity-55' : '', isNow(a) ? 'bg-primary/10' : '']">
              <span class="font-mono text-xs font-semibold" :class="isNow(a) ? 'text-primary' : 'text-toned'">{{ fmtDate(a.startsAt, 'HH:mm') }}</span>
              <div class="bg-elevated border-default flex size-9 items-center justify-center rounded-full border text-[0.65rem] font-semibold">{{ initials(a.clientName) }}</div>
              <div class="min-w-0 flex-1"><div class="flex items-center gap-2"><span class="truncate text-sm font-semibold" :class="a.status === 'completed' ? 'line-through' : ''">{{ a.clientName }}</span><ClientInfoButton :name="a.clientName" :phone="a.clientPhone" :email="a.clientEmail" /></div><div class="text-dimmed truncate text-xs">{{ a.serviceName }} · {{ formatPrice(a.price) }}</div></div>
              <span v-if="a.status === 'completed'" class="text-success flex items-center gap-1 text-xs font-semibold"><UIcon name="i-lucide-check" class="size-3.5" />Hecha</span>
              <AdminPill v-else-if="isNow(a)" kind="confirmed">Ahora</AdminPill>
              <UIcon v-else name="i-lucide-chevron-right" class="text-dimmed size-4" />
            </NuxtLink>
          </div>
          <UiEmptyState v-else icon="i-lucide-calendar-x" title="Sin citas hoy" description="Disfruta del día libre." />
        </section>
      </div>
    </div>

    <!-- ░░░ ESCRITORIO ░░░ -->
    <div class="hidden lg:block">
      <AdminHeader title="Mi día" :sub="`${fmtDate(today, 'EEEE d MMM')} · ${me?.name ?? 'Barbero'}`" />

      <div class="space-y-4 px-7 py-6">
        <!-- KPIs -->
        <div class="grid grid-cols-4 gap-4">
          <AdminKpi icon="i-lucide-calendar" label="Citas hoy" :value="stats.count" />
          <AdminKpi icon="i-lucide-check" label="Completadas" :value="stats.done" />
          <AdminKpi icon="i-lucide-euro" label="Ganado hoy" :value="formatPrice(stats.earned)" />
          <AdminKpi icon="i-lucide-star" label="Valoración" :value="stats.rating" />
        </div>

        <div class="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
          <!-- agenda de hoy -->
          <AdminCard :pad="false">
            <div class="border-default flex items-center justify-between border-b px-5 py-4">
              <div>
                <div class="font-display text-lg">Mi agenda de hoy</div>
                <div class="text-dimmed mt-0.5 text-xs">{{ stats.count }} citas · {{ stats.done }} completadas</div>
              </div>
              <UButton to="/staff/agenda" color="neutral" variant="ghost" size="sm" icon="i-lucide-calendar-days">Ver semana</UButton>
            </div>
            <div v-if="list.length" class="px-5 pb-2">
              <NuxtLink v-for="a in list" :key="a.id" :to="`/staff/cita/${a.id}`" class="border-default flex items-center gap-4 border-b py-3 last:border-b-0" :class="a.status === 'completed' ? 'opacity-55' : ''">
                <span class="w-12 shrink-0 text-right font-mono text-[0.8rem] font-semibold" :class="isNow(a) ? 'text-primary' : ''">{{ fmtDate(a.startsAt, 'HH:mm') }}</span>
                <span class="h-9 w-[3px] shrink-0 rounded-full" :style="{ background: isNow(a) ? 'var(--jdvm-accent)' : 'var(--jdvm-accent-line)' }" />
                <div class="bg-elevated border-default flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">{{ initials(a.clientName) }}</div>
                <div class="min-w-0 flex-1"><div class="flex items-center gap-2"><span class="truncate text-sm font-semibold" :class="a.status === 'completed' ? 'line-through' : ''">{{ a.clientName }}</span><ClientInfoButton :name="a.clientName" :phone="a.clientPhone" :email="a.clientEmail" /></div><div class="text-dimmed truncate text-xs">{{ a.serviceName }} · {{ formatPrice(a.price) }}</div></div>
                <AdminPill :kind="isNow(a) ? 'confirmed' : pillKind(a.status)">{{ a.status === 'completed' ? 'Hecha' : isNow(a) ? 'En curso' : 'Confirmada' }}</AdminPill>
              </NuxtLink>
            </div>
            <div v-else class="p-6"><UiEmptyState icon="i-lucide-calendar-x" title="Sin citas hoy" description="Disfruta del día libre." /></div>
          </AdminCard>

          <!-- rail derecho -->
          <div class="space-y-4">
            <AdminCard v-if="current" class="border-primary/30">
              <div class="mb-3.5 flex items-center gap-2">
                <span class="bg-primary size-1.5 rounded-full" style="box-shadow: 0 0 0 3px var(--jdvm-accent-soft)" />
                <span class="text-primary font-mono text-[0.6rem] tracking-[0.15em] uppercase">En curso · quedan {{ remaining }} min</span>
              </div>
              <div class="flex items-center gap-3.5">
                <div class="border-primary/40 bg-elevated flex size-12 items-center justify-center rounded-full border text-sm font-semibold">{{ initials(current.clientName) }}</div>
                <div class="min-w-0 flex-1"><div class="truncate text-base font-semibold">{{ current.clientName }}</div><div class="text-toned truncate text-sm">{{ current.serviceName }} · {{ fmtDate(current.startsAt, 'HH:mm') }}</div></div>
                <div class="font-display text-2xl">{{ formatPrice(current.price) }}</div>
              </div>
              <div class="mt-4 flex gap-2.5">
                <UButton v-if="current.clientPhone" :to="`tel:${current.clientPhone}`" color="neutral" variant="soft" icon="i-lucide-phone">Llamar</UButton>
                <div class="flex-1" />
                <UButton color="primary" icon="i-lucide-check" @click="markDone(current.id)">Marcar hecha</UButton>
              </div>
            </AdminCard>

            <AdminCard>
              <div class="flex items-baseline justify-between">
                <div class="font-display text-lg">Mi semana</div>
                <span class="text-primary font-display text-xl">{{ formatPrice(weekTotal) }}</span>
              </div>
              <div class="mt-5 flex h-28 items-end gap-2.5">
                <div v-for="(d, i) in week" :key="i" class="flex flex-1 flex-col items-center gap-2">
                  <div class="flex h-24 w-full items-end">
                    <div class="w-full rounded-[5px] border" :class="d.val === maxWeek ? 'bg-primary border-primary' : 'bg-primary/15 border-primary/30'" :style="{ height: `${d.val ? Math.max(6, (d.val / maxWeek) * 100) : 0}%` }" />
                  </div>
                  <span class="font-mono text-[0.65rem] capitalize" :class="d.val === maxWeek ? 'text-primary' : 'text-dimmed'">{{ d.letter }}</span>
                </div>
              </div>
            </AdminCard>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
