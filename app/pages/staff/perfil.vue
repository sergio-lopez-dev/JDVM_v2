<script setup lang="ts">
import { WEEKDAYS, type Weekday, type WeekTimetable, type DayTimetable } from '~~/schemas'

definePageMeta({ layout: 'barber', middleware: 'barber' })
useHead({ title: 'Perfil · Barbero' })

const toast = useToast()
const { signOut } = useAuth()
const { update } = useBarbers()
const { services } = useServices()
const { id, me, rating, myReviews, enriched } = useBarber()

const clientsCount = computed(() => new Set(enriched.value.map((a) => a.clientId)).size)
const monthCount = computed(() => {
  const s = new Date()
  s.setDate(s.getDate() - 30)
  return enriched.value.filter((a) => a.startsAt >= s && a.status !== 'cancelled').length
})

const DAY_LABELS: Record<Weekday, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
}
const FULL_DAY: DayTimetable = {
  morning: { start: '10:00', end: '14:00' },
  afternoon: { start: '16:00', end: '20:00' },
}

function span(dt?: DayTimetable) {
  if (!dt) return 'Libre'
  const start = dt.morning?.start ?? dt.afternoon?.start
  const end = dt.afternoon?.end ?? dt.morning?.end
  return start && end ? `${start} – ${end}` : 'Libre'
}

const saving = ref(false)
async function toggleDay(day: Weekday, open: boolean) {
  if (!id.value || saving.value) return
  const src = (me.value?.timetable ?? {}) as WeekTimetable
  const next: WeekTimetable = {}
  for (const [k, v] of Object.entries(src)) {
    if (k !== day && v) next[k as Weekday] = v
  }
  if (open) next[day] = { ...FULL_DAY }
  saving.value = true
  try {
    await update(id.value, { timetable: next })
  } catch (e) {
    toast.add({ title: 'No se pudo guardar', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

const offeredServices = computed(() =>
  services.value.filter((s) => me.value?.servicesOffered?.includes(s.id)),
)

function requestDayOff() {
  toast.add({ title: 'Día libre solicitado', description: 'El administrador lo revisará.', icon: 'i-lucide-calendar' })
}
</script>

<template>
  <div>
    <!-- ░░░ MÓVIL ░░░ -->
    <div class="flex flex-1 flex-col lg:hidden">
    <header class="flex items-center justify-between px-5 pt-5 pb-2">
      <h1 class="font-display text-3xl">Perfil</h1>
      <button type="button" aria-label="Cerrar sesión" class="text-toned" @click="signOut"><UIcon name="i-lucide-log-out" class="size-5" /></button>
    </header>

    <div class="flex-1 space-y-6 px-5 py-3 pb-6">
      <!-- identidad -->
      <div class="flex items-center gap-4">
        <UiAvatar :name="me?.name" :src="me?.photoUrl || null" :size="64" ring="var(--jdvm-accent-line)" />
        <div class="flex-1">
          <p class="font-display text-2xl leading-none">{{ me?.name || 'Barbero' }}</p>
          <p class="text-primary mt-1.5 font-mono text-[0.65rem] tracking-wide">Barbero</p>
        </div>
      </div>

      <!-- disponibilidad -->
      <section>
        <div class="mb-3 flex items-center justify-between">
          <h2 class="font-display text-xl">Mi disponibilidad</h2>
          <span class="text-dimmed text-xs">Toca para abrir/cerrar</span>
        </div>
        <div class="border-default overflow-hidden rounded-2xl border">
          <div
            v-for="(d, i) in WEEKDAYS"
            :key="d"
            class="flex items-center gap-3 px-4 py-3"
            :class="i ? 'border-default border-t' : ''"
          >
            <span class="w-10 text-sm font-semibold" :class="me?.timetable?.[d] ? 'text-default' : 'text-dimmed'">{{ DAY_LABELS[d] }}</span>
            <span class="flex-1 font-mono text-xs" :class="me?.timetable?.[d] ? 'text-toned' : 'text-dimmed'">{{ span(me?.timetable?.[d]) }}</span>
            <USwitch :model-value="!!me?.timetable?.[d]" :disabled="saving" @update:model-value="toggleDay(d, $event)" />
          </div>
        </div>
        <UButton color="neutral" variant="outline" size="lg" block icon="i-lucide-calendar" class="mt-3 justify-center" @click="requestDayOff">Solicitar día libre</UButton>
      </section>

      <!-- servicios (solo lectura) -->
      <section>
        <div class="mb-3 flex items-center gap-2">
          <h2 class="font-display text-xl">Servicios que ofrezco</h2>
          <span class="border-default bg-accented text-dimmed inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase"><UIcon name="i-lucide-lock" class="size-2.5" />Local</span>
        </div>
        <div class="flex flex-wrap gap-2">
          <span v-for="s in offeredServices" :key="s.id" class="border-default bg-muted text-toned rounded-full border px-3 py-1.5 text-xs">{{ s.name }}</span>
        </div>
        <div class="border-default mt-3 flex gap-2.5 rounded-xl border border-dashed p-3.5">
          <UIcon name="i-lucide-lock" class="text-dimmed size-4 shrink-0" />
          <span class="text-dimmed text-xs leading-relaxed">La carta, los precios y el equipo los gestiona el administrador del local.</span>
        </div>
      </section>

      <NotificationToggle />
    </div>
    </div>

    <!-- ░░░ ESCRITORIO ░░░ -->
    <div class="hidden lg:block">
      <AdminHeader title="Mi perfil" sub="Tus datos, disponibilidad y servicios">
        <template #actions>
          <UButton color="neutral" variant="soft" icon="i-lucide-log-out" @click="signOut">Cerrar sesión</UButton>
        </template>
      </AdminHeader>

      <div class="grid gap-4 px-7 py-6 xl:grid-cols-2 xl:items-start">
        <!-- columna izquierda -->
        <div class="space-y-4">
          <AdminCard class="flex items-center gap-5">
            <UiAvatar :name="me?.name" :src="me?.photoUrl || null" :size="76" ring="var(--jdvm-accent-line)" />
            <div class="flex-1">
              <div class="font-display text-2xl leading-none">{{ me?.name || 'Barbero' }}</div>
              <div class="text-primary mt-1.5 font-mono text-[0.65rem] tracking-wide uppercase">Barbero</div>
              <div class="mt-3 flex gap-6">
                <div><div class="font-display text-xl">{{ rating ? rating.toFixed(1).replace('.', ',') : '—' }}</div><div class="text-dimmed text-[0.65rem]">★ {{ myReviews.length }} reseñas</div></div>
                <div><div class="font-display text-xl">{{ monthCount }}</div><div class="text-dimmed text-[0.65rem]">Citas/mes</div></div>
                <div><div class="font-display text-xl">{{ clientsCount }}</div><div class="text-dimmed text-[0.65rem]">Clientes</div></div>
              </div>
            </div>
          </AdminCard>

          <AdminCard :pad="false">
            <div class="border-default flex items-center justify-between border-b px-5 py-4">
              <div class="font-display text-lg">Mi disponibilidad</div>
              <AdminPill kind="done">Tú la gestionas</AdminPill>
            </div>
            <div class="px-5 pb-2">
              <div v-for="(d, i) in WEEKDAYS" :key="d" class="border-default flex items-center border-b py-3 last:border-b-0" :class="i ? '' : ''">
                <span class="w-24 text-sm font-semibold" :class="me?.timetable?.[d] ? 'text-default' : 'text-dimmed'">{{ DAY_LABELS[d] }}</span>
                <span class="flex-1 font-mono text-sm" :class="me?.timetable?.[d] ? 'text-toned' : 'text-dimmed'">{{ span(me?.timetable?.[d]) }}</span>
                <USwitch :model-value="!!me?.timetable?.[d]" :disabled="saving" @update:model-value="toggleDay(d, $event)" />
              </div>
            </div>
            <div class="px-5 pb-4"><UButton color="neutral" variant="soft" icon="i-lucide-calendar" @click="requestDayOff">Solicitar día libre</UButton></div>
          </AdminCard>
        </div>

        <!-- columna derecha -->
        <div class="space-y-4">
          <AdminCard>
            <div class="mb-4 flex items-center gap-2.5">
              <span class="font-display text-lg">Servicios que ofrezco</span>
              <span class="border-default bg-accented text-dimmed inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 font-mono text-[0.55rem] uppercase"><UIcon name="i-lucide-lock" class="size-2.5" />Gestiona el local</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <span v-for="s in offeredServices" :key="s.id" class="border-default bg-accented text-toned rounded-full border px-3.5 py-2 text-sm">{{ s.name }}</span>
            </div>
            <div class="border-default mt-4 flex gap-2.5 rounded-xl border border-dashed p-3.5">
              <UIcon name="i-lucide-lock" class="text-dimmed size-4 shrink-0" />
              <span class="text-dimmed text-xs leading-relaxed">La carta de servicios y los precios los define el administrador del local. Si quieres ofrecer un servicio nuevo, solicítaselo.</span>
            </div>
          </AdminCard>

          <AdminCard :pad="false">
            <div class="border-default font-display border-b px-5 py-4 text-lg">Cuenta</div>
            <NuxtLink to="/avisos" class="border-default flex items-center gap-3 border-b px-5 py-3.5">
              <div class="bg-accented flex size-9 items-center justify-center rounded-[10px]"><UIcon name="i-lucide-bell" class="text-primary size-4" /></div>
              <div class="flex-1"><div class="text-sm font-semibold">Notificaciones</div><div class="text-dimmed text-xs">Avisos de nuevas citas</div></div>
              <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4" />
            </NuxtLink>
            <button type="button" class="border-default flex w-full items-center gap-3 border-b px-5 py-3.5 text-left" @click="signOut">
              <div class="bg-accented flex size-9 items-center justify-center rounded-[10px]"><UIcon name="i-lucide-log-out" class="text-error size-4" /></div>
              <div class="flex-1"><div class="text-error text-sm font-semibold">Cerrar sesión</div><div class="text-dimmed text-xs">Salir de tu cuenta</div></div>
            </button>
          </AdminCard>

          <NotificationToggle />
        </div>
      </div>
    </div>
  </div>
</template>
