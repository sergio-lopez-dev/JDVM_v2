<script setup lang="ts">
import { fmtDate, formatPrice } from '~~/lib/format'
import { sameDay } from '~~/lib/datetime'

definePageMeta({ layout: 'barber', middleware: 'barber' })
useHead({ title: 'Mis ingresos · Barbero' })

const { today, enriched, rating, myReviews, me } = useBarber()
const user = useCurrentUser()
const pct = computed(() => me.value?.commissionPercent ?? 50)

// Registro de venta de producto (el margen es del local; aquí solo se anota).
const saleOpen = ref(false)

const period = ref<'semana' | 'mes'>('semana')

function startOfWeek(d: Date) {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x
}

const range = computed(() => {
  if (period.value === 'mes') {
    const s = new Date(today.value.getFullYear(), today.value.getMonth(), 1)
    const e = new Date(today.value.getFullYear(), today.value.getMonth() + 1, 1)
    return { start: s, end: e }
  }
  const s = startOfWeek(today.value)
  const e = new Date(s)
  e.setDate(e.getDate() + 7)
  return { start: s, end: e }
})
const prevRange = computed(() => {
  const span = range.value.end.getTime() - range.value.start.getTime()
  return { start: new Date(range.value.start.getTime() - span), end: range.value.start }
})

function inRange(d: Date, r: { start: Date; end: Date }) {
  return d.getTime() >= r.start.getTime() && d.getTime() < r.end.getTime()
}
const done = computed(() => enriched.value.filter((a) => a.status === 'completed'))

const totals = computed(() => {
  const cur = done.value.filter((a) => inRange(a.startsAt, range.value))
  const servicios = cur.reduce((s, a) => s + a.price, 0)
  const propinas = cur.reduce((s, a) => s + (a.tip ?? 0), 0)
  const share = (servicios * pct.value) / 100
  const total = share + propinas
  const prev = done.value.filter((a) => inRange(a.startsAt, prevRange.value))
  const prevTotal =
    (prev.reduce((s, a) => s + a.price, 0) * pct.value) / 100 +
    prev.reduce((s, a) => s + (a.tip ?? 0), 0)
  const delta = prevTotal ? Math.round(((total - prevTotal) / prevTotal) * 100) : null
  return { servicios, propinas, share, total, count: cur.length, delta }
})

// Barras: ingreso por día de la semana actual.
const week = computed(() => {
  const s = startOfWeek(today.value)
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(s)
    day.setDate(day.getDate() + i)
    const dayDone = done.value.filter((a) => sameDay(a.startsAt, day))
    const val =
      (dayDone.reduce((sum, a) => sum + a.price, 0) * pct.value) / 100 +
      dayDone.reduce((sum, a) => sum + (a.tip ?? 0), 0)
    return { letter: fmtDate(day, 'EEEEE'), val }
  })
})
const maxVal = computed(() => Math.max(1, ...week.value.map((d) => d.val)))

// Estimación del próximo pago = tu parte del mes en curso.
const monthEstimate = computed(() => {
  const s = new Date(today.value.getFullYear(), today.value.getMonth(), 1)
  const e = new Date(today.value.getFullYear(), today.value.getMonth() + 1, 1)
  const cur = done.value.filter((a) => inRange(a.startsAt, { start: s, end: e }))
  return (cur.reduce((x, a) => x + a.price, 0) * pct.value) / 100 + cur.reduce((x, a) => x + (a.tip ?? 0), 0)
})
const periodLabel = computed(() => (period.value === 'semana' ? 'esta semana' : 'este mes'))
</script>

<template>
  <div>
    <!-- ░░░ MÓVIL ░░░ -->
    <div class="flex flex-1 flex-col lg:hidden">
    <header class="flex items-center justify-between px-5 pt-5 pb-3">
      <h1 class="font-display text-3xl">Mis ingresos</h1>
      <div class="border-default bg-muted inline-flex rounded-[9px] border p-0.5">
        <button v-for="o in (['semana', 'mes'] as const)" :key="o" type="button" class="rounded-[7px] px-3 py-1.5 text-xs font-semibold capitalize" :class="period === o ? 'bg-primary text-inverted' : 'text-toned'" @click="period = o">{{ o }}</button>
      </div>
    </header>

    <div class="flex-1 space-y-4 px-5 pb-6">
      <!-- número grande -->
      <div class="border-primary/30 rounded-2xl border p-5" style="background: linear-gradient(135deg, var(--jdvm-bg-2), var(--jdvm-bg-1))">
        <p class="text-primary font-mono text-[0.6rem] tracking-[0.12em] uppercase">Tu parte est{{ period === 'semana' ? 'a semana' : 'e mes' }}</p>
        <p class="font-display mt-2 text-5xl leading-none">{{ formatPrice(Math.round(totals.total)) }}</p>
        <div v-if="totals.delta !== null" class="mt-2.5 flex items-center gap-2">
          <span class="inline-flex items-center gap-1 text-xs font-semibold" :class="totals.delta >= 0 ? 'text-success' : 'text-error'">
            <UIcon name="i-lucide-trending-up" class="size-3.5" :class="totals.delta >= 0 ? '' : '-scale-y-100'" />{{ totals.delta >= 0 ? '+' : '' }}{{ totals.delta }}%
          </span>
          <span class="text-dimmed text-xs">vs. {{ period === 'semana' ? 'semana' : 'mes' }} anterior</span>
        </div>
        <div class="mt-5 flex h-[70px] items-end gap-2.5">
          <div v-for="(d, i) in week" :key="i" class="flex flex-1 flex-col items-center gap-1.5">
            <div class="flex h-12 w-full items-end">
              <div class="w-full rounded border" :class="d.val === maxVal ? 'bg-primary border-primary' : 'bg-primary/15 border-primary/30'" :style="{ height: `${d.val ? Math.max(6, (d.val / maxVal) * 100) : 0}%` }" />
            </div>
            <span class="font-mono text-[0.6rem] capitalize" :class="d.val === maxVal ? 'text-primary' : 'text-dimmed'">{{ d.letter }}</span>
          </div>
        </div>
      </div>

      <!-- desglose -->
      <div class="border-default bg-muted rounded-2xl border px-4">
        <div class="border-default flex items-center gap-3 border-b py-3.5">
          <div class="bg-accented flex size-8 items-center justify-center rounded-[9px]"><UIcon name="i-lucide-scissors" class="text-primary size-4" /></div>
          <span class="flex-1 text-sm font-medium">Servicios ({{ totals.count }})</span>
          <span class="text-toned font-mono text-sm">{{ formatPrice(totals.servicios) }}</span>
        </div>
        <div class="border-default flex items-center gap-3 border-b py-3.5">
          <div class="bg-accented flex size-8 items-center justify-center rounded-[9px]"><UIcon name="i-lucide-percent" class="text-primary size-4" /></div>
          <span class="flex-1 text-sm font-medium">Tu comisión · {{ pct }}%</span>
          <span class="font-display text-lg">{{ formatPrice(Math.round(totals.share)) }}</span>
        </div>
        <div class="flex items-center gap-3 py-3.5">
          <div class="bg-accented flex size-8 items-center justify-center rounded-[9px]"><UIcon name="i-lucide-gift" class="text-primary size-4" /></div>
          <span class="flex-1 text-sm font-medium">Propinas</span>
          <span class="font-display text-lg">{{ formatPrice(totals.propinas) }}</span>
        </div>
      </div>

      <!-- registrar venta de producto (el importe es para la barbería) -->
      <div class="space-y-1.5">
        <UButton block size="lg" color="primary" variant="soft" icon="i-lucide-shopping-cart" @click="saleOpen = true">Registrar venta de producto</UButton>
        <p class="text-dimmed text-center text-[0.7rem]">El importe de los productos es para la barbería, no cuenta en tu comisión.</p>
      </div>

      <!-- rating + citas -->
      <div class="grid grid-cols-2 gap-3">
        <div class="border-default bg-muted rounded-2xl border p-4">
          <div class="flex items-center gap-1.5"><UIcon name="i-lucide-star" class="text-primary size-4" /><span class="font-display text-2xl">{{ rating ? rating.toFixed(1).replace('.', ',') : '—' }}</span></div>
          <div class="text-dimmed mt-1 text-xs">Valoración · {{ myReviews.length }} reseñas</div>
        </div>
        <div class="border-default bg-muted rounded-2xl border p-4">
          <div class="font-display text-2xl">{{ totals.count }}</div>
          <div class="text-dimmed mt-1 text-xs">Citas {{ period === 'semana' ? 'esta semana' : 'este mes' }}</div>
        </div>
      </div>

      <!-- nota -->
      <div class="border-default flex gap-2.5 rounded-xl border border-dashed p-3.5">
        <UIcon name="i-lucide-lock" class="text-dimmed size-4 shrink-0" />
        <span class="text-dimmed text-xs leading-relaxed">Los pagos los liquida el local cada mes. Las comisiones y tarifas las gestiona el administrador.</span>
      </div>
    </div>
    </div>

    <!-- ░░░ ESCRITORIO ░░░ -->
    <div class="hidden lg:block">
      <AdminHeader title="Mis ingresos" sub="Tus ganancias, esta vista es solo tuya">
        <template #actions>
          <UButton color="primary" variant="soft" icon="i-lucide-shopping-cart" @click="saleOpen = true">Registrar venta</UButton>
          <div class="border-default bg-muted inline-flex rounded-[10px] border p-1">
            <button v-for="o in (['semana', 'mes'] as const)" :key="o" type="button" class="rounded-[7px] px-3.5 py-1.5 text-sm font-semibold capitalize" :class="period === o ? 'bg-primary text-inverted' : 'text-toned'" @click="period = o">{{ o }}</button>
          </div>
        </template>
      </AdminHeader>

      <div class="space-y-4 px-7 py-6">
        <div class="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
          <!-- hero ganancias -->
          <AdminCard class="border-primary/30" style="background: linear-gradient(135deg, var(--jdvm-bg-2), var(--jdvm-bg-1))">
            <div class="flex items-start justify-between gap-4">
              <div>
                <p class="text-primary font-mono text-[0.6rem] tracking-[0.12em] uppercase">Tu parte {{ periodLabel }}</p>
                <p class="font-display mt-2 text-6xl leading-none">{{ formatPrice(Math.round(totals.total)) }}</p>
                <div v-if="totals.delta !== null" class="mt-3 flex items-center gap-2">
                  <span class="inline-flex items-center gap-1 text-sm font-semibold" :class="totals.delta >= 0 ? 'text-success' : 'text-error'"><UIcon name="i-lucide-trending-up" class="size-4" :class="totals.delta >= 0 ? '' : '-scale-y-100'" />{{ totals.delta >= 0 ? '+' : '' }}{{ totals.delta }}%</span>
                  <span class="text-dimmed text-sm">vs. {{ period }} anterior</span>
                </div>
              </div>
              <div class="flex h-32 w-52 items-end gap-2">
                <div v-for="(d, i) in week" :key="i" class="flex flex-1 flex-col items-center gap-1.5">
                  <div class="flex h-24 w-full items-end"><div class="w-full rounded border" :class="d.val === maxVal ? 'bg-primary border-primary' : 'bg-primary/15 border-primary/30'" :style="{ height: `${d.val ? Math.max(6, (d.val / maxVal) * 100) : 0}%` }" /></div>
                  <span class="font-mono text-[0.6rem] capitalize" :class="d.val === maxVal ? 'text-primary' : 'text-dimmed'">{{ d.letter }}</span>
                </div>
              </div>
            </div>
          </AdminCard>

          <!-- rating + citas -->
          <div class="space-y-4">
            <AdminCard class="flex items-center gap-4">
              <div class="bg-primary/15 flex size-12 items-center justify-center rounded-xl"><UIcon name="i-lucide-star" class="text-primary size-6" /></div>
              <div><div class="font-display text-3xl leading-none">{{ rating ? rating.toFixed(1).replace('.', ',') : '—' }}</div><div class="text-dimmed mt-1 text-xs">{{ myReviews.length }} reseñas</div></div>
            </AdminCard>
            <AdminCard class="flex items-center gap-4">
              <div class="bg-primary/15 flex size-12 items-center justify-center rounded-xl"><UIcon name="i-lucide-scissors" class="text-primary size-6" /></div>
              <div><div class="font-display text-3xl leading-none">{{ totals.count }}</div><div class="text-dimmed mt-1 text-xs">citas {{ periodLabel }}</div></div>
            </AdminCard>
          </div>
        </div>

        <div class="grid gap-4 xl:grid-cols-[1.5fr_1fr] xl:items-start">
          <!-- desglose -->
          <AdminCard :pad="false">
            <div class="border-default font-display border-b px-5 py-4 text-lg">Desglose</div>
            <div class="px-5 pb-2">
              <div class="border-default flex items-center gap-4 border-b py-3.5">
                <div class="bg-accented flex size-9 items-center justify-center rounded-[10px]"><UIcon name="i-lucide-scissors" class="text-primary size-4" /></div>
                <div class="flex-1"><div class="text-sm font-semibold">Servicios realizados</div><div class="text-dimmed text-xs">{{ totals.count }} citas</div></div>
                <span class="text-toned font-mono">{{ formatPrice(totals.servicios) }}</span>
              </div>
              <div class="border-default flex items-center gap-4 border-b py-3.5">
                <div class="bg-accented flex size-9 items-center justify-center rounded-[10px]"><UIcon name="i-lucide-percent" class="text-primary size-4" /></div>
                <div class="flex-1"><div class="text-sm font-semibold">Tu comisión</div><div class="text-dimmed text-xs">{{ pct }}% · ya aplicada</div></div>
                <span class="font-display text-xl">{{ formatPrice(Math.round(totals.share)) }}</span>
              </div>
              <div class="flex items-center gap-4 py-3.5">
                <div class="bg-accented flex size-9 items-center justify-center rounded-[10px]"><UIcon name="i-lucide-gift" class="text-primary size-4" /></div>
                <div class="flex-1"><div class="text-sm font-semibold">Propinas</div><div class="text-dimmed text-xs">100% para ti</div></div>
                <span class="font-display text-xl">{{ formatPrice(totals.propinas) }}</span>
              </div>
              <div class="border-default flex items-baseline justify-between border-t py-4">
                <span class="text-sm font-semibold">Total tu parte</span>
                <span class="font-display text-3xl">{{ formatPrice(Math.round(totals.total)) }}</span>
              </div>
            </div>
          </AdminCard>

          <!-- liquidación -->
          <AdminCard class="border-dashed">
            <div class="mb-3 flex items-center gap-2.5">
              <UIcon name="i-lucide-lock" class="text-dimmed size-4" />
              <span class="font-display text-lg">Liquidación</span>
            </div>
            <p class="text-toned text-sm leading-relaxed">El local liquida tu parte el <strong class="text-default">día 1 de cada mes</strong>. Las comisiones y tarifas las define el administrador — esta vista es informativa.</p>
            <div class="border-default bg-accented mt-4 flex items-center justify-between rounded-xl border p-3.5">
              <div><div class="text-dimmed text-xs">Próximo pago · estimado</div><div class="mt-0.5 text-sm font-semibold">tu parte de este mes</div></div>
              <span class="text-primary font-display text-2xl">{{ formatPrice(Math.round(monthEstimate)) }}</span>
            </div>
          </AdminCard>
        </div>
      </div>
    </div>

    <ProductSaleModal v-model:open="saleOpen" :default-seller="user?.uid ?? ''" />
  </div>
</template>
