<script setup lang="ts">
import { VisXYContainer, VisStackedBar, VisAxis, VisSingleContainer, VisDonut } from '@unovis/vue'
import { formatPrice } from '~~/lib/format'
import type { DayCount, RankRow } from '~/composables/useAdminStats'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Reports · Admin' })

const GOLD = '#C2A24E'

// Rango: últimos N días (incluye hoy).
const days = ref(30)
const range = computed(() => {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  end.setDate(end.getDate() + 1)
  const start = new Date(end)
  start.setDate(start.getDate() - days.value)
  return { start, end }
})
const rangeStart = computed(() => range.value.start)
const rangeEnd = computed(() => range.value.end)

const { totals, perDay, topServices, perBarber } = useAdminStats(rangeStart, rangeEnd)

// — Gráfico de barras: citas por día —
const barX = (_d: DayCount, i: number) => i
const barY = (d: DayCount) => d.count
const xTick = (i: number) => perDay.value[i]?.label ?? ''

// — Donut: ranking de servicios (top 6) —
const donutData = computed(() => topServices.value.slice(0, 6))
const donutValue = (d: RankRow) => d.count
const PALETTE = ['#C2A24E', '#6FA98A', '#A6857B', '#7C8C9E', '#DCC07A', '#5E7C6B']
const donutColor = (_d: RankRow, i: number) => PALETTE[i % PALETTE.length]

const maxBarberCount = computed(() => Math.max(1, ...perBarber.value.map((b) => b.count)))
</script>

<template>
  <div>
    <AdminHeader title="Reports" sub="Métricas del estudio">
      <template #actions>
        <div class="border-default flex overflow-hidden rounded-xl border text-sm">
          <button
            v-for="d in [7, 30, 90]"
            :key="d"
            type="button"
            class="border-default border-r px-3 py-2 font-medium last:border-r-0"
            :class="days === d ? 'bg-primary/15 text-primary' : 'text-muted hover:bg-elevated'"
            @click="days = d"
          >
            {{ d }}d
          </button>
        </div>
      </template>
    </AdminHeader>

    <div class="space-y-6 px-5 py-6 pb-24 lg:px-7 lg:pb-6">
      <!-- KPIs -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="border-default bg-muted rounded-2xl border p-4">
          <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Citas</p>
          <p class="font-display mt-1 text-3xl">{{ totals.appointments }}</p>
        </div>
        <div class="border-default bg-muted rounded-2xl border p-4">
          <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Ingresos</p>
          <p class="font-display text-primary mt-1 text-3xl">{{ formatPrice(totals.revenue) }}</p>
        </div>
        <div class="border-default bg-muted rounded-2xl border p-4">
          <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Canceladas</p>
          <p class="font-display mt-1 text-3xl">{{ totals.cancelled }}</p>
        </div>
        <div class="border-default bg-muted rounded-2xl border p-4">
          <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">No-show</p>
          <p class="font-display mt-1 text-3xl">{{ totals.noShow }}</p>
        </div>
      </div>

      <div class="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <!-- citas por día -->
        <section class="border-default bg-muted rounded-2xl border p-5">
          <h2 class="font-display mb-4 text-xl">Citas por día</h2>
          <ClientOnly>
            <div class="h-64">
              <VisXYContainer :data="perDay" :height="256">
                <VisStackedBar :x="barX" :y="barY" :color="GOLD" :rounded-corners="4" :bar-padding="0.3" />
                <VisAxis type="x" :tick-format="xTick" :grid-line="false" :num-ticks="Math.min(perDay.length, 10)" />
                <VisAxis type="y" :grid-line="true" :tick-format="(v: number) => String(Math.round(v))" />
              </VisXYContainer>
            </div>
            <template #fallback><div class="text-dimmed flex h-64 items-center justify-center text-sm">Cargando…</div></template>
          </ClientOnly>
        </section>

        <!-- ranking servicios (donut) -->
        <section class="border-default bg-muted rounded-2xl border p-5">
          <h2 class="font-display mb-4 text-xl">Servicios más pedidos</h2>
          <div v-if="donutData.length" class="flex flex-col items-center gap-4">
            <ClientOnly>
              <div class="h-44 w-44">
                <VisSingleContainer :data="donutData" :height="176">
                  <VisDonut :value="donutValue" :color="donutColor" :arc-width="22" :central-label="String(totals.appointments)" central-sub-label="citas" />
                </VisSingleContainer>
              </div>
            </ClientOnly>
            <div class="w-full space-y-1.5">
              <div v-for="(s, i) in donutData" :key="s.id" class="flex items-center gap-2 text-sm">
                <span class="size-2.5 rounded-full" :style="{ background: PALETTE[i % PALETTE.length] }" />
                <span class="flex-1 truncate">{{ s.name }}</span>
                <span class="text-dimmed font-mono text-xs">{{ s.count }}</span>
              </div>
            </div>
          </div>
          <UiEmptyState v-else icon="i-lucide-chart-pie" title="Sin datos" description="No hay citas en el periodo." />
        </section>
      </div>

      <!-- ocupación por barbero -->
      <section class="border-default bg-muted rounded-2xl border p-5">
        <h2 class="font-display mb-4 text-xl">Por barbero</h2>
        <div v-if="perBarber.some((b) => b.count)" class="space-y-3">
          <div v-for="b in perBarber" :key="b.id" class="flex items-center gap-3">
            <span class="w-28 shrink-0 truncate text-sm font-medium">{{ b.name }}</span>
            <div class="bg-elevated h-6 flex-1 overflow-hidden rounded-lg">
              <div class="bg-primary flex h-full items-center justify-end rounded-lg px-2 text-[0.65rem] font-semibold text-inverted" :style="{ width: `${(b.count / maxBarberCount) * 100}%` }">
                <span v-if="b.count">{{ b.count }}</span>
              </div>
            </div>
            <span class="font-display w-16 shrink-0 text-right text-base">{{ formatPrice(b.revenue) }}</span>
          </div>
        </div>
        <UiEmptyState v-else icon="i-lucide-users" title="Sin actividad" description="No hay citas en el periodo." />
      </section>
    </div>
  </div>
</template>
