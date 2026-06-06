<script setup lang="ts">
import { fmtDate } from '~~/lib/format'
import { toDate } from '~~/lib/datetime'
import { DEFAULT_TIERS, type LoyaltyTier, type Reward } from '~~/schemas'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Fidelización · Admin' })

const { settings, save } = useSettings()
const { rewards, createReward, updateReward, removeReward, resolveRedemption, adminRedemptions } =
  useLoyalty()
const { pending } = adminRedemptions()
const toast = useToast()

// — Config —
const form = reactive({
  enabled: false,
  pointsPerEuro: 1,
  expiryMonths: 12,
  tiers: structuredClone(DEFAULT_TIERS) as LoyaltyTier[],
})

watch(
  settings,
  (s) => {
    const l = s?.loyalty
    if (!l) return
    form.enabled = l.enabled ?? false
    form.pointsPerEuro = l.pointsPerEuro ?? 1
    form.expiryMonths = l.expiryMonths ?? 12
    form.tiers = structuredClone(toRaw(l.tiers?.length ? l.tiers : DEFAULT_TIERS))
  },
  { immediate: true },
)

function addTier() {
  form.tiers.push({ key: `tier-${form.tiers.length}`, name: 'Nuevo nivel', minPoints: 0 })
}
function removeTier(i: number) {
  form.tiers.splice(i, 1)
}
function slug(s: string) {
  return s.trim().toLowerCase().replace(/\s+/g, '-') || 'nivel'
}

const saving = ref(false)
async function saveConfig() {
  saving.value = true
  try {
    const tiers = form.tiers
      .map((t) => ({ key: t.key || slug(t.name), name: t.name.trim() || 'Nivel', minPoints: Math.max(0, Math.round(t.minPoints || 0)) }))
      .sort((a, b) => a.minPoints - b.minPoints)
    await save({
      loyalty: {
        enabled: form.enabled,
        pointsPerEuro: Number(form.pointsPerEuro) || 0,
        expiryMonths: Math.max(1, Math.round(Number(form.expiryMonths) || 12)),
        tiers,
      },
    })
    toast.add({ title: 'Fidelización guardada', icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toast.add({ title: 'No se pudo guardar', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

// — Recompensas —
const ICONS = [
  'i-lucide-gift',
  'i-lucide-scissors',
  'i-lucide-beer',
  'i-lucide-shirt',
  'i-lucide-coffee',
  'i-lucide-percent',
  'i-lucide-star',
  'i-lucide-sparkles',
]
const editing = ref<string | null>(null)
const reward = reactive({ name: '', description: '', pointsCost: 100, icon: 'i-lucide-gift', active: true })

function resetReward() {
  editing.value = null
  reward.name = ''
  reward.description = ''
  reward.pointsCost = 100
  reward.icon = 'i-lucide-gift'
  reward.active = true
}
function editReward(r: Reward) {
  editing.value = r.id
  reward.name = r.name
  reward.description = r.description ?? ''
  reward.pointsCost = r.pointsCost
  reward.icon = r.icon || 'i-lucide-gift'
  reward.active = r.active
}

const savingReward = ref(false)
async function submitReward() {
  if (!reward.name.trim() || !reward.pointsCost) {
    toast.add({ title: 'Faltan datos', description: 'Nombre y coste son obligatorios.', color: 'warning' })
    return
  }
  savingReward.value = true
  try {
    const payload = {
      name: reward.name.trim(),
      description: reward.description.trim(),
      pointsCost: Math.max(1, Math.round(reward.pointsCost)),
      icon: reward.icon,
      active: reward.active,
    }
    if (editing.value) await updateReward(editing.value, payload)
    else await createReward(payload)
    toast.add({ title: editing.value ? 'Recompensa actualizada' : 'Recompensa creada', icon: 'i-lucide-check', color: 'success' })
    resetReward()
  } catch (e) {
    toast.add({ title: 'No se pudo guardar', description: (e as Error).message, color: 'error' })
  } finally {
    savingReward.value = false
  }
}
async function deleteReward(r: Reward) {
  if (!confirm(`¿Eliminar la recompensa "${r.name}"?`)) return
  await removeReward(r.id)
  if (editing.value === r.id) resetReward()
}

const sortedRewards = computed(() => [...rewards.value].sort((a, b) => a.pointsCost - b.pointsCost))

// — Canjes pendientes —
async function resolve(id: string, status: 'fulfilled' | 'cancelled') {
  await resolveRedemption(id, status)
  toast.add({
    title: status === 'fulfilled' ? 'Canje entregado' : 'Canje anulado',
    icon: status === 'fulfilled' ? 'i-lucide-check' : 'i-lucide-x',
    color: status === 'fulfilled' ? 'success' : 'neutral',
  })
}
</script>

<template>
  <div>
    <AdminHeader title="Fidelización" sub="Puntos, niveles y recompensas del programa Socio">
      <template #actions>
        <UButton color="primary" icon="i-lucide-check" :loading="saving" @click="saveConfig">Guardar ajustes</UButton>
      </template>
    </AdminHeader>

    <div class="grid max-w-4xl gap-4 px-5 py-6 pb-24 lg:px-7 lg:pb-6">
      <!-- activar -->
      <AdminCard :pad="false">
        <div class="flex items-center justify-between p-5">
          <div>
            <p class="text-sm font-semibold">Programa de fidelización</p>
            <p class="text-dimmed text-xs">Si lo desactivas, los clientes dejan de ver puntos y recompensas.</p>
          </div>
          <USwitch v-model="form.enabled" size="lg" />
        </div>
      </AdminCard>

      <!-- reglas de puntos -->
      <AdminCard>
        <h2 class="font-display text-lg">Reglas de puntos</h2>
        <p class="text-muted mt-1 text-sm">Cómo se ganan y cuándo caducan los puntos.</p>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <label class="text-muted mb-1.5 block text-xs font-medium">Puntos por € gastado</label>
            <UInput v-model.number="form.pointsPerEuro" type="number" min="0" step="0.5" size="lg">
              <template #trailing><span class="text-dimmed text-xs">pts/€</span></template>
            </UInput>
            <p class="text-dimmed mt-1 text-xs">Ej.: un corte de 18 € da {{ Math.floor(18 * (Number(form.pointsPerEuro) || 0)) }} pts.</p>
          </div>
          <div>
            <label class="text-muted mb-1.5 block text-xs font-medium">Caducidad de los puntos</label>
            <UInput v-model.number="form.expiryMonths" type="number" min="1" step="1" size="lg">
              <template #trailing><span class="text-dimmed text-xs">meses</span></template>
            </UInput>
            <p class="text-dimmed mt-1 text-xs">Cada bolsa de puntos caduca tras este tiempo desde la visita.</p>
          </div>
        </div>
      </AdminCard>

      <!-- niveles -->
      <AdminCard>
        <div class="flex items-center justify-between">
          <div>
            <h2 class="font-display text-lg">Niveles de socio</h2>
            <p class="text-muted mt-1 text-sm">Se alcanzan por puntos ganados (activos). Canjear no baja de nivel.</p>
          </div>
          <UButton color="neutral" variant="outline" size="sm" icon="i-lucide-plus" @click="addTier">Añadir</UButton>
        </div>
        <div class="mt-4 space-y-2.5">
          <div v-for="(t, i) in form.tiers" :key="i" class="flex items-center gap-3">
            <UIcon name="i-lucide-award" class="text-primary size-5 shrink-0" />
            <UInput v-model="t.name" placeholder="Nombre" class="flex-1" />
            <UInput v-model.number="t.minPoints" type="number" min="0" class="w-32">
              <template #trailing><span class="text-dimmed text-xs">pts</span></template>
            </UInput>
            <UButton color="error" variant="ghost" size="sm" icon="i-lucide-trash-2" :disabled="form.tiers.length <= 1" @click="removeTier(i)" />
          </div>
        </div>
      </AdminCard>

      <!-- recompensas -->
      <AdminCard :pad="false">
        <div class="border-default flex items-center justify-between border-b px-5 py-4">
          <h2 class="font-display text-lg">Recompensas canjeables</h2>
          <span class="text-dimmed font-mono text-xs">{{ rewards.length }}</span>
        </div>
        <div v-if="sortedRewards.length">
          <div
            v-for="r in sortedRewards"
            :key="r.id"
            class="border-default flex items-center gap-3 border-t px-5 py-3 first:border-t-0"
          >
            <div class="bg-elevated flex size-10 shrink-0 items-center justify-center rounded-xl">
              <UIcon :name="r.icon || 'i-lucide-gift'" class="text-primary size-5" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">{{ r.name }} <span v-if="!r.active" class="text-dimmed font-normal">· oculta</span></p>
              <p class="text-dimmed truncate text-xs">{{ r.description || '—' }}</p>
            </div>
            <span class="text-primary bg-primary/10 border-primary/30 shrink-0 rounded-full border px-2.5 py-1 font-mono text-xs font-semibold">{{ r.pointsCost }} pts</span>
            <UButton color="neutral" variant="ghost" size="sm" icon="i-lucide-pencil" @click="editReward(r)" />
            <UButton color="error" variant="ghost" size="sm" icon="i-lucide-trash-2" @click="deleteReward(r)" />
          </div>
        </div>
        <div v-else class="px-5 py-8">
          <UiEmptyState icon="i-lucide-gift" title="Sin recompensas" description="Crea la primera abajo (corte gratis, camiseta, cerveza…)." />
        </div>
      </AdminCard>

      <!-- editor de recompensa -->
      <AdminCard>
        <h2 class="font-display text-lg">{{ editing ? 'Editar recompensa' : 'Nueva recompensa' }}</h2>
        <div class="mt-4 space-y-4">
          <div class="grid gap-4 sm:grid-cols-[1fr_auto]">
            <div>
              <label class="text-muted mb-1.5 block text-xs font-medium">Nombre</label>
              <UInput v-model="reward.name" placeholder="Corte gratis" size="lg" class="w-full" />
            </div>
            <div>
              <label class="text-muted mb-1.5 block text-xs font-medium">Coste</label>
              <UInput v-model.number="reward.pointsCost" type="number" min="1" size="lg" class="w-32">
                <template #trailing><span class="text-dimmed text-xs">pts</span></template>
              </UInput>
            </div>
          </div>
          <div>
            <label class="text-muted mb-1.5 block text-xs font-medium">Descripción</label>
            <UInput v-model="reward.description" placeholder="Un servicio de corte de pelo, gratis." size="lg" class="w-full" />
          </div>
          <div>
            <label class="text-muted mb-1.5 block text-xs font-medium">Icono</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="ic in ICONS"
                :key="ic"
                type="button"
                class="flex size-10 items-center justify-center rounded-xl border"
                :class="reward.icon === ic ? 'border-primary bg-primary/15 text-primary' : 'border-default bg-muted text-muted'"
                @click="reward.icon = ic"
              >
                <UIcon :name="ic" class="size-5" />
              </button>
            </div>
          </div>
          <div class="flex items-center justify-between">
            <label class="flex items-center gap-2 text-sm"><USwitch v-model="reward.active" /> Visible para los clientes</label>
            <div class="flex gap-2">
              <UButton v-if="editing" color="neutral" variant="outline" @click="resetReward">Cancelar</UButton>
              <UButton color="primary" icon="i-lucide-check" :loading="savingReward" @click="submitReward">{{ editing ? 'Guardar' : 'Crear recompensa' }}</UButton>
            </div>
          </div>
        </div>
      </AdminCard>

      <!-- canjes pendientes -->
      <AdminCard :pad="false">
        <div class="border-default flex items-center justify-between border-b px-5 py-4">
          <h2 class="font-display text-lg">Canjes pendientes</h2>
          <span class="text-dimmed font-mono text-xs">{{ pending.length }}</span>
        </div>
        <div v-if="pending.length">
          <div
            v-for="r in pending"
            :key="r.id"
            class="border-default flex items-center gap-3 border-t px-5 py-3 first:border-t-0"
          >
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-semibold">{{ r.rewardName }}</p>
              <p class="text-dimmed truncate text-xs">
                {{ r.userName || 'Cliente' }} · {{ r.pointsCost }} pts
                <span v-if="r.createdAt"> · {{ fmtDate(toDate(r.createdAt), 'd MMM HH:mm') }}</span>
              </p>
            </div>
            <UButton color="primary" size="sm" icon="i-lucide-check" @click="resolve(r.id, 'fulfilled')">Entregar</UButton>
            <UButton color="neutral" variant="outline" size="sm" @click="resolve(r.id, 'cancelled')">Anular</UButton>
          </div>
        </div>
        <div v-else class="px-5 py-8">
          <UiEmptyState icon="i-lucide-check-check" title="Sin canjes pendientes" description="Aquí verás las recompensas que pidan tus clientes." />
        </div>
      </AdminCard>
    </div>
  </div>
</template>
