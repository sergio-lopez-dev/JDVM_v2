<script setup lang="ts">
import { fmtDate } from '~~/lib/format'
import { toDate } from '~~/lib/datetime'
import type { Reward, Redemption } from '~~/schemas'

definePageMeta({ layout: 'inner', middleware: 'auth' })
useHead({ title: 'Socio' })

const { enabled, config, mySummary, activeRewards, mineRedemptions, redeem } = useLoyalty()
const { settings } = useSettings()
const toast = useToast()

// `enabled` arranca en false hasta que cargan los settings; solo redirigimos una
// vez tenemos el documento, para no expulsar al usuario antes de tiempo.
const settingsLoaded = computed(() => settings.value !== undefined && settings.value !== null)
watchEffect(() => {
  if (settingsLoaded.value && !enabled.value) navigateTo('/perfil')
})

const summary = computed(() => mySummary.value)

const redeeming = ref<string | null>(null)
async function onRedeem(r: Reward) {
  if (summary.value.balance < r.pointsCost) return
  redeeming.value = r.id
  try {
    await redeem(r)
    toast.add({
      title: '¡Canje solicitado!',
      description: `Recoge "${r.name}" en el estudio. Lo confirmamos allí.`,
      icon: 'i-lucide-gift',
      color: 'success',
    })
  } catch (e) {
    toast.add({ title: 'No se pudo canjear', description: (e as Error).message, color: 'error' })
  } finally {
    redeeming.value = null
  }
}

const STATUS_META: Record<string, { label: string; class: string }> = {
  pending: { label: 'Pendiente', class: 'text-warning bg-warning/15' },
  fulfilled: { label: 'Entregado', class: 'text-success bg-success/15' },
  cancelled: { label: 'Anulado', class: 'text-dimmed bg-elevated' },
}
const myRedemptions = computed(() =>
  [...mineRedemptions.value].sort(
    (a: Redemption, b: Redemption) =>
      (b.createdAt ? toDate(b.createdAt).getTime() : 0) - (a.createdAt ? toDate(a.createdAt).getTime() : 0),
  ),
)
</script>

<template>
  <div class="flex flex-1 flex-col">
    <!-- cabecera con back (solo móvil; en escritorio está la top-nav) -->
    <header class="flex items-center justify-between px-5 pt-4 pb-2 lg:hidden">
      <button
        type="button"
        aria-label="Atrás"
        class="border-default bg-elevated flex size-9 items-center justify-center rounded-xl border"
        @click="$router.back()"
      >
        <UIcon name="i-lucide-chevron-left" class="size-5" />
      </button>
      <span class="font-display text-lg">Socio</span>
      <span class="w-9" />
    </header>

    <div class="flex-1 space-y-6 px-5 py-3 lg:px-0 lg:py-2">
      <h1 class="font-display hidden text-4xl lg:block">Socio</h1>

      <!-- tarjeta de nivel + saldo -->
      <div
        class="border-primary/30 relative overflow-hidden rounded-2xl border p-6"
        style="background: linear-gradient(135deg, var(--jdvm-bg-2), var(--jdvm-bg-1))"
      >
        <UiGrain :opacity="0.2" />
        <div class="relative">
          <div class="flex items-center justify-between">
            <span class="text-primary flex items-center gap-2 font-mono text-[0.65rem] tracking-widest uppercase">
              <UIcon name="i-lucide-award" class="size-4" />Socio · {{ summary.tier.name }}
            </span>
            <AppLogo variant="mark" :size="18" />
          </div>

          <div class="mt-5 flex items-end gap-2">
            <span class="font-display text-5xl leading-none">{{ summary.balance }}</span>
            <span class="text-muted mb-1 text-sm">puntos disponibles</span>
          </div>

          <!-- progreso al siguiente nivel -->
          <div v-if="summary.nextTier" class="mt-5">
            <div class="text-muted mb-1.5 flex justify-between text-xs">
              <span>{{ summary.tier.name }}</span>
              <span>{{ summary.toNextTier }} pts para {{ summary.nextTier.name }}</span>
            </div>
            <div class="bg-default h-2 overflow-hidden rounded-full">
              <div class="bg-primary h-full rounded-full transition-all" :style="{ width: `${Math.round(summary.progress * 100)}%` }" />
            </div>
          </div>
          <p v-else class="text-primary mt-5 text-xs font-semibold">¡Has alcanzado el nivel máximo!</p>

          <!-- caducidad -->
          <div v-if="summary.nextExpiry" class="border-default text-dimmed mt-5 flex items-center gap-2 border-t pt-4 text-xs">
            <UIcon name="i-lucide-clock" class="size-3.5" />
            {{ summary.nextExpiry.points }} pts caducan el {{ fmtDate(summary.nextExpiry.at, "d 'de' MMMM yyyy") }}.
          </div>
        </div>
      </div>

      <p class="text-muted text-xs">
        Ganas <span class="text-default font-semibold">{{ config.pointsPerEuro }} pts por €</span> en cada cita completada.
        Canjéalos por recompensas y recógelas en el estudio.
      </p>

      <!-- catálogo de recompensas -->
      <section>
        <h2 class="font-display mb-3 text-xl">Recompensas</h2>
        <div v-if="activeRewards.length" class="space-y-2.5">
          <div
            v-for="r in activeRewards"
            :key="r.id"
            class="border-default bg-muted flex items-center gap-3.5 rounded-2xl border p-4"
            :class="summary.balance < r.pointsCost ? 'opacity-60' : ''"
          >
            <div class="bg-primary/15 flex size-12 shrink-0 items-center justify-center rounded-xl">
              <UIcon :name="r.icon || 'i-lucide-gift'" class="text-primary size-6" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">{{ r.name }}</p>
              <p class="text-dimmed truncate text-xs">{{ r.description || `${r.pointsCost} puntos` }}</p>
            </div>
            <div class="shrink-0 text-right">
              <UButton
                v-if="summary.balance >= r.pointsCost"
                color="primary"
                size="sm"
                :loading="redeeming === r.id"
                @click="onRedeem(r)"
              >
                Canjear · {{ r.pointsCost }}
              </UButton>
              <template v-else>
                <p class="font-display text-lg leading-none">{{ r.pointsCost }}</p>
                <p class="text-dimmed text-[0.65rem]">te faltan {{ r.pointsCost - summary.balance }}</p>
              </template>
            </div>
          </div>
        </div>
        <UiEmptyState
          v-else
          icon="i-lucide-gift"
          title="Aún no hay recompensas"
          description="El estudio añadirá recompensas que podrás canjear con tus puntos."
        />
      </section>

      <!-- mis canjes -->
      <section v-if="myRedemptions.length" class="pb-6">
        <h2 class="font-display mb-3 text-xl">Mis canjes</h2>
        <div class="border-default overflow-hidden rounded-2xl border">
          <div
            v-for="r in myRedemptions"
            :key="r.id"
            class="border-default flex items-center gap-3 border-t px-4 py-3 first:border-t-0"
          >
            <UIcon name="i-lucide-gift" class="text-muted size-4 shrink-0" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">{{ r.rewardName }}</p>
              <p v-if="r.createdAt" class="text-dimmed text-xs">{{ fmtDate(toDate(r.createdAt), 'd MMM yyyy') }} · {{ r.pointsCost }} pts</p>
            </div>
            <span class="rounded-full px-2 py-0.5 font-mono text-[0.55rem] tracking-wide uppercase" :class="(STATUS_META[r.status] ?? STATUS_META.pending)!.class">
              {{ (STATUS_META[r.status] ?? STATUS_META.pending)!.label }}
            </span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>
