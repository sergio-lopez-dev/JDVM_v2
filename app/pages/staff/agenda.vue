<script setup lang="ts">
import { fmtDate, formatPrice, initials } from '~~/lib/format'
import { sameDay } from '~~/lib/datetime'
import { freeWindows, resolveDayTimetable } from '~~/lib/slots'

definePageMeta({ layout: 'barber', middleware: 'barber' })
useHead({ title: 'Mi agenda · Barbero' })

const toast = useToast()
const { today, onDay, isNow, me, now } = useBarber()
const { settings } = useSettings()

function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}
const selectedDay = ref(new Date(today.value))
const weekDays = computed(() =>
  Array.from({ length: 6 }, (_, i) => {
    const d = startOfWeek(today.value)
    d.setDate(d.getDate() + i)
    return d
  }),
)
const list = onDay(selectedDay)

function shiftDay(n: number) {
  const d = new Date(selectedDay.value)
  d.setDate(d.getDate() + n)
  selectedDay.value = d
}
const summary = computed(() => {
  const valid = list.value.filter((a) => a.status === 'booked' || a.status === 'completed')
  return {
    count: list.value.length,
    done: list.value.filter((a) => a.status === 'completed').length,
    forecast: valid.reduce((s, a) => s + a.price, 0),
  }
})
const nextAppt = computed(() =>
  list.value.find((a) => a.status === 'booked' && a.startsAt.getTime() > now.value.getTime()) ?? null,
)

// Huecos LIBRES del día (horario local ∩ horario del barbero − citas ocupadas).
const freeSlots = computed(() => {
  if (!me.value) return []
  const localTt = settings.value ? resolveDayTimetable(settings.value.timetable, selectedDay.value) : undefined
  const barberTt = resolveDayTimetable(me.value.timetable, selectedDay.value)
  const busy = list.value
    .filter((a) => a.status === 'booked' || a.status === 'completed')
    .map((a) => ({ start: a.startsAt, end: a.endsAt }))
  return freeWindows({
    day: selectedDay.value,
    localTimetable: localTt,
    barberTimetable: barberTt,
    busy,
    now: now.value,
    minMinutes: 10,
  })
})

function blockSlot() {
  toast.add({ title: 'Bloquear hueco', description: 'Disponible próximamente.', icon: 'i-lucide-lock' })
}
</script>

<template>
  <div>
    <!-- ░░░ MÓVIL ░░░ -->
    <div class="flex flex-1 flex-col lg:hidden">
      <header class="flex items-center justify-between px-5 pt-5 pb-3">
        <h1 class="font-display text-3xl">Mi agenda</h1>
        <button type="button" class="text-primary bg-primary/10 border-primary/30 flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold" @click="blockSlot"><UIcon name="i-lucide-lock" class="size-3.5" />Bloquear hueco</button>
      </header>
      <div class="grid grid-cols-6 gap-1.5 px-5 pb-3">
        <button v-for="d in weekDays" :key="d.toISOString()" type="button" class="flex flex-col items-center gap-1 rounded-xl border py-2" :class="sameDay(d, selectedDay) ? 'border-primary bg-primary text-inverted' : 'border-default bg-muted'" @click="selectedDay = d">
          <span class="font-mono text-[0.6rem] uppercase">{{ fmtDate(d, 'EEEEE') }}</span>
          <span class="font-display text-lg leading-none">{{ fmtDate(d, 'd') }}</span>
        </button>
      </div>
      <div class="flex items-center gap-2.5 px-5 pb-2">
        <span class="font-display text-base capitalize">{{ fmtDate(selectedDay, 'EEEE d') }}</span>
        <span class="bg-border h-px flex-1" />
        <span class="text-dimmed font-mono text-[0.7rem]">{{ list.length }} citas</span>
      </div>
      <div class="flex-1 px-5 pt-2 pb-6">
        <div v-if="list.length">
          <NuxtLink v-for="(a, i) in list" :key="a.id" :to="`/staff/cita/${a.id}`" class="flex gap-3">
            <div class="w-11 shrink-0 pt-3 text-right"><span class="font-mono text-xs font-semibold" :class="isNow(a) ? 'text-primary' : 'text-toned'">{{ fmtDate(a.startsAt, 'HH:mm') }}</span></div>
            <div class="relative">
              <span class="ring-default absolute top-4 -left-px size-2.5 rounded-full ring-2" :style="{ background: isNow(a) ? 'var(--jdvm-accent)' : 'var(--jdvm-accent-tint)' }" />
              <span v-if="i < list.length - 1" class="bg-border absolute top-6 left-[3px] bottom-0 w-px" />
            </div>
            <div class="mb-3 flex-1 rounded-2xl border border-l-[3px] p-3.5" :class="isNow(a) ? 'border-primary/40 bg-primary/10' : 'border-default bg-muted'" :style="{ borderLeftColor: 'var(--jdvm-accent)', opacity: a.status === 'completed' ? 0.6 : 1 }">
              <div class="flex items-center gap-3">
                <div class="bg-elevated border-default flex size-8 shrink-0 items-center justify-center rounded-full border text-[0.65rem] font-semibold">{{ initials(a.clientName) }}</div>
                <div class="min-w-0 flex-1"><div class="flex items-center gap-2"><span class="truncate text-sm font-semibold">{{ a.clientName }}</span><ClientInfoButton :name="a.clientName" :phone="a.clientPhone" :email="a.clientEmail" /></div><div class="text-dimmed truncate text-xs">{{ a.serviceName }}</div></div>
                <UIcon v-if="a.status === 'completed'" name="i-lucide-check" class="text-success size-4" />
                <AdminPill v-else-if="isNow(a)" kind="confirmed">Ahora</AdminPill>
              </div>
            </div>
          </NuxtLink>
        </div>
        <UiEmptyState v-else icon="i-lucide-calendar-x" title="Sin citas" :description="`No tienes citas el ${fmtDate(selectedDay, 'd MMM')}.`" />

        <!-- huecos libres del día -->
        <div v-if="freeSlots.length" class="mt-5">
          <p class="text-dimmed mb-2.5 flex items-center gap-1.5 font-mono text-[0.6rem] tracking-widest uppercase"><span class="bg-success size-1.5 rounded-full" />Huecos libres</p>
          <div class="flex flex-wrap gap-2">
            <span v-for="(f, i) in freeSlots" :key="i" class="border-success/30 bg-success/10 text-success rounded-lg border px-2.5 py-1.5 font-mono text-xs font-semibold">{{ fmtDate(f.start, 'HH:mm') }}–{{ fmtDate(f.end, 'HH:mm') }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ░░░ ESCRITORIO ░░░ -->
    <div class="hidden lg:block">
      <AdminHeader title="Mi agenda" :sub="`Solo tus citas · ${me?.name ?? 'Barbero'}`">
        <template #actions>
          <UButton color="neutral" variant="soft" icon="i-lucide-lock" @click="blockSlot">Bloquear hueco</UButton>
        </template>
      </AdminHeader>

      <div class="px-7 py-6">
        <!-- nav de día -->
        <div class="mb-4 flex items-center gap-3">
          <button type="button" aria-label="Anterior" class="border-default bg-muted hover:bg-elevated flex size-10 items-center justify-center rounded-[10px] border" @click="shiftDay(-1)"><UIcon name="i-lucide-chevron-left" class="size-4" /></button>
          <div class="font-display text-2xl capitalize">{{ fmtDate(selectedDay, 'EEEE d MMM') }}</div>
          <button type="button" aria-label="Siguiente" class="border-default bg-muted hover:bg-elevated flex size-10 items-center justify-center rounded-[10px] border" @click="shiftDay(1)"><UIcon name="i-lucide-chevron-right" class="size-4" /></button>
          <UButton color="neutral" variant="ghost" size="sm" @click="selectedDay = new Date(today)">Hoy</UButton>
        </div>

        <div class="grid gap-4 xl:grid-cols-[1.7fr_1fr] xl:items-start">
          <!-- timeline -->
          <AdminCard :pad="false">
            <div class="border-default flex items-center gap-3 border-b px-5 py-4">
              <div class="border-primary/40 bg-elevated flex size-9 items-center justify-center rounded-full border text-xs font-semibold">{{ initials(me?.name) }}</div>
              <div class="flex-1"><div class="text-sm font-semibold">{{ me?.name ?? 'Barbero' }} · tú</div><div class="text-dimmed text-xs">{{ summary.count }} citas · {{ summary.done }} completadas</div></div>
            </div>
            <div v-if="list.length" class="px-5 py-2">
              <NuxtLink v-for="a in list" :key="a.id" :to="`/staff/cita/${a.id}`" class="border-default flex items-center gap-4 border-b py-3 last:border-b-0" :class="a.status === 'completed' ? 'opacity-55' : ''">
                <span class="w-12 shrink-0 text-right font-mono text-[0.8rem] font-semibold" :class="isNow(a) ? 'text-primary' : ''">{{ fmtDate(a.startsAt, 'HH:mm') }}</span>
                <span class="h-9 w-[3px] shrink-0 rounded-full" :style="{ background: isNow(a) ? 'var(--jdvm-accent)' : 'var(--jdvm-accent-line)' }" />
                <div class="bg-elevated border-default flex size-9 shrink-0 items-center justify-center rounded-full border text-xs font-semibold">{{ initials(a.clientName) }}</div>
                <div class="min-w-0 flex-1"><div class="flex items-center gap-2"><span class="truncate text-sm font-semibold">{{ a.clientName }}</span><ClientInfoButton :name="a.clientName" :phone="a.clientPhone" :email="a.clientEmail" /></div><div class="text-dimmed truncate text-xs">{{ a.serviceName }} · {{ formatPrice(a.price) }}</div></div>
                <AdminPill :kind="isNow(a) ? 'confirmed' : a.status === 'completed' ? 'done' : 'confirmed'">{{ a.status === 'completed' ? 'Hecha' : isNow(a) ? 'En curso' : 'Confirmada' }}</AdminPill>
              </NuxtLink>
            </div>
            <div v-else class="p-8"><UiEmptyState icon="i-lucide-calendar-x" title="Sin citas" description="No tienes citas este día." /></div>
          </AdminCard>

          <!-- rail -->
          <div class="space-y-4">
            <AdminCard>
              <div class="font-display mb-3 text-lg">Resumen del día</div>
              <div class="border-default flex items-center justify-between border-t py-2.5"><span class="text-toned text-sm">Citas</span><span class="font-display text-lg">{{ summary.count }}</span></div>
              <div class="border-default flex items-center justify-between border-t py-2.5"><span class="text-toned text-sm">Completadas</span><span class="font-display text-lg">{{ summary.done }}</span></div>
              <div class="border-default flex items-center justify-between border-t py-2.5"><span class="text-toned text-sm">Previsto</span><span class="font-display text-primary text-lg">{{ formatPrice(summary.forecast) }}</span></div>
            </AdminCard>

            <AdminCard v-if="freeSlots.length">
              <div class="font-display mb-3 flex items-center gap-2 text-lg"><span class="bg-success size-2 rounded-full" />Huecos libres</div>
              <div class="flex flex-wrap gap-2">
                <span v-for="(f, i) in freeSlots" :key="i" class="border-success/30 bg-success/10 text-success rounded-lg border px-2.5 py-1.5 font-mono text-xs font-semibold">{{ fmtDate(f.start, 'HH:mm') }}–{{ fmtDate(f.end, 'HH:mm') }}</span>
              </div>
            </AdminCard>

            <AdminCard v-if="nextAppt" class="border-primary/30">
              <p class="text-primary font-mono text-[0.6rem] tracking-[0.15em] uppercase">Siguiente cita</p>
              <div class="mt-3 flex items-center gap-3">
                <div class="border-primary/40 bg-elevated flex size-11 items-center justify-center rounded-full border text-sm font-semibold">{{ initials(nextAppt.clientName) }}</div>
                <div class="min-w-0 flex-1"><div class="truncate text-sm font-semibold">{{ nextAppt.clientName }}</div><div class="text-toned truncate text-xs">{{ nextAppt.serviceName }} · {{ fmtDate(nextAppt.startsAt, 'HH:mm') }}</div></div>
                <div class="font-display text-xl">{{ formatPrice(nextAppt.price) }}</div>
              </div>
            </AdminCard>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
