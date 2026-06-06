<script setup lang="ts">
import { formatPrice, formatDuration, initials } from '~~/lib/format'
import type { Service, ServiceInput, ServiceCategoryDef } from '~~/schemas'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Servicios · Admin' })

const { services, create, update, remove } = useServices()
const { barbers, update: updateBarber } = useBarbers()
const { categories, add: addCategory, rename: renameCategory, remove: removeCategory } =
  useServiceCategories()
const toast = useToast()

// Servicios agrupados en el ORDEN de las categorías + un grupo "Sin categoría".
const grouped = computed(() => {
  const sorted = [...services.value].sort((a, b) => a.name.localeCompare(b.name))
  const groups = categories.value.map((c) => ({
    id: c.id,
    name: c.name,
    list: sorted.filter((s) => s.category === c.id),
  }))
  const known = new Set(categories.value.map((c) => c.id))
  const orphans = sorted.filter((s) => !s.category || !known.has(s.category))
  if (orphans.length) groups.push({ id: '', name: 'Sin categoría', list: orphans })
  return groups.filter((g) => g.list.length)
})

const countIn = (id: string) => services.value.filter((s) => (s.category ?? '') === id).length

// — Gestión de categorías —
const newCat = ref('')
async function onAddCategory() {
  if (!newCat.value.trim()) return
  await addCategory(newCat.value)
  newCat.value = ''
}
async function onRemoveCategory(c: ServiceCategoryDef) {
  const n = countIn(c.id)
  const msg = n
    ? `¿Borrar la categoría "${c.name}"? ${n} servicio(s) quedarán sin categoría.`
    : `¿Borrar la categoría "${c.name}"?`
  if (!confirm(msg)) return
  // Reasigna los servicios afectados a "sin categoría" antes de borrarla.
  await Promise.all(
    services.value.filter((s) => s.category === c.id).map((s) => update(s.id, { category: '' })),
  )
  await removeCategory(c.id)
  toast.add({ title: 'Categoría eliminada', icon: 'i-lucide-trash-2' })
}

interface FormState {
  id: string | null
  name: string
  description: string
  durationMinutes: number
  basePrice: number
  category: string
  color: string
  isPrivate: boolean
  barberIds: string[]
  priceOverrides: Record<string, number | undefined>
  durationOverrides: Record<string, number | undefined>
}

function blank(): FormState {
  return {
    id: null,
    name: '',
    description: '',
    durationMinutes: 30,
    basePrice: 15,
    category: categories.value[0]?.id ?? '',
    color: '#C2A24E',
    isPrivate: false,
    barberIds: barbers.value.map((b) => b.id),
    priceOverrides: {},
    durationOverrides: {},
  }
}

const form = ref<FormState | null>(null)
const saving = ref(false)
const panelOpen = computed(() => form.value !== null)

function startCreate() {
  form.value = blank()
}
function startEdit(s: Service) {
  form.value = {
    id: s.id,
    name: s.name,
    description: s.description ?? '',
    durationMinutes: s.durationMinutes,
    basePrice: s.basePrice,
    category: s.category ?? categories.value[0]?.id ?? '',
    color: s.color ?? '#C2A24E',
    isPrivate: s.isPrivate ?? false,
    barberIds: barbers.value.filter((b) => b.servicesOffered?.includes(s.id)).map((b) => b.id),
    priceOverrides: { ...(s.priceOverrides ?? {}) },
    durationOverrides: { ...(s.durationOverrides ?? {}) },
  }
}
function toggleBarber(id: string) {
  if (!form.value) return
  const list = form.value.barberIds
  const i = list.indexOf(id)
  if (i >= 0) list.splice(i, 1)
  else list.push(id)
}

async function syncBarbers(serviceId: string, desired: string[]) {
  const want = new Set(desired)
  await Promise.all(
    barbers.value.map((b) => {
      const has = b.servicesOffered?.includes(serviceId) ?? false
      if (want.has(b.id) === has) return null
      const next = has
        ? (b.servicesOffered ?? []).filter((x) => x !== serviceId)
        : [...(b.servicesOffered ?? []), serviceId]
      return updateBarber(b.id, { servicesOffered: next })
    }),
  )
}

async function save() {
  const f = form.value
  if (!f) return
  if (!f.name.trim()) {
    toast.add({ title: 'El nombre es obligatorio', color: 'error', icon: 'i-lucide-triangle-alert' })
    return
  }
  saving.value = true
  try {
    const overrides: Record<string, number> = {}
    for (const [bid, val] of Object.entries(f.priceOverrides)) {
      if (val != null && !Number.isNaN(val)) overrides[bid] = val
    }
    const durOverrides: Record<string, number> = {}
    for (const [bid, val] of Object.entries(f.durationOverrides)) {
      if (val != null && !Number.isNaN(val)) durOverrides[bid] = Math.max(5, Math.round(val))
    }
    const payload: ServiceInput = {
      name: f.name.trim(),
      description: f.description,
      durationMinutes: Math.max(5, Math.round(f.durationMinutes)),
      basePrice: Math.max(0, f.basePrice),
      category: f.category,
      color: f.color,
      isPrivate: f.isPrivate,
      priceOverrides: overrides,
      durationOverrides: durOverrides,
    }
    let id = f.id
    if (id) await update(id, payload)
    else id = (await create(payload)).id
    await syncBarbers(id, f.barberIds)
    toast.add({ title: f.id ? 'Servicio actualizado' : 'Servicio creado', icon: 'i-lucide-check', color: 'success' })
    form.value = null
  } catch (e) {
    toast.add({ title: 'No se pudo guardar', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function confirmRemove() {
  if (!form.value?.id) return
  if (!confirm(`¿Eliminar "${form.value.name}"?`)) return
  await remove(form.value.id)
  toast.add({ title: 'Servicio eliminado', icon: 'i-lucide-trash-2' })
  form.value = null
}
</script>

<template>
  <div>
    <AdminHeader title="Servicios" sub="Configura tu carta: precios, duración y disponibilidad">
      <template #actions>
        <UButton color="primary" icon="i-lucide-plus" @click="startCreate">Añadir servicio</UButton>
      </template>
    </AdminHeader>

    <div class="grid gap-4 px-5 py-6 pb-24 lg:grid-cols-[1.55fr_1fr] lg:items-start lg:px-7 lg:pb-6">
      <!-- catálogo -->
      <div class="space-y-4">
        <!-- gestión de categorías -->
        <AdminCard>
          <div class="flex items-center justify-between">
            <h2 class="font-display text-lg">Categorías de la carta</h2>
            <span class="text-dimmed font-mono text-xs">{{ categories.length }}</span>
          </div>
          <p class="text-muted mt-1 text-sm">Crea, renombra o borra categorías. Al borrar una, sus servicios quedan “Sin categoría”.</p>
          <div class="mt-4 space-y-2">
            <div v-for="c in categories" :key="c.id" class="flex items-center gap-2">
              <UIcon name="i-lucide-tag" class="text-primary size-4 shrink-0" />
              <input
                :value="c.name"
                class="border-default bg-default focus:border-primary flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none"
                @change="renameCategory(c.id, ($event.target as HTMLInputElement).value)"
              />
              <span class="text-dimmed w-12 text-right font-mono text-[0.7rem]">{{ countIn(c.id) }} serv.</span>
              <UButton color="error" variant="ghost" size="sm" icon="i-lucide-trash-2" @click="onRemoveCategory(c)" />
            </div>
          </div>
          <div class="mt-3 flex gap-2">
            <input
              v-model="newCat"
              placeholder="Nueva categoría…"
              class="border-default bg-default focus:border-primary flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
              @keydown.enter="onAddCategory"
            />
            <UButton color="neutral" variant="outline" icon="i-lucide-plus" :disabled="!newCat.trim()" @click="onAddCategory">Añadir</UButton>
          </div>
        </AdminCard>

        <AdminCard v-for="g in grouped" :key="g.id" :pad="false">
          <div class="border-default flex items-center justify-between border-b px-5 py-3.5">
            <div class="flex items-center gap-2.5">
              <span class="text-primary font-display text-lg">{{ g.name }}</span>
              <span class="bg-accented text-dimmed rounded-md px-1.5 py-0.5 font-mono text-[0.6rem]">{{ g.list.length }}</span>
            </div>
          </div>
          <button
            v-for="s in g.list"
            :key="s.id"
            type="button"
            class="border-default flex w-full items-center gap-3.5 border-b border-l-[3px] px-5 py-3.5 text-left transition-colors last:border-b-0"
            :class="form?.id === s.id ? 'border-l-primary bg-primary/10' : 'hover:bg-elevated border-l-transparent'"
            @click="startEdit(s)"
          >
            <span class="bg-accented flex size-9 shrink-0 items-center justify-center rounded-[9px]">
              <UIcon name="i-lucide-scissors" class="size-4" :class="s.isPrivate ? 'text-dimmed' : 'text-primary'" />
            </span>
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold" :class="s.isPrivate ? 'text-dimmed' : ''">{{ s.name }}</div>
              <div class="text-dimmed truncate text-xs">{{ s.description || '—' }}</div>
            </div>
            <span class="text-dimmed w-16 text-right font-mono text-xs">{{ formatDuration(s.durationMinutes) }}</span>
            <span class="font-display w-14 text-right text-xl" :class="s.isPrivate ? 'text-dimmed' : ''">{{ formatPrice(s.basePrice) }}</span>
            <UIcon v-if="s.isPrivate" name="i-lucide-lock" class="text-dimmed size-4 shrink-0" />
            <UIcon v-else name="i-lucide-eye" class="text-success/70 size-4 shrink-0" />
          </button>
        </AdminCard>
      </div>

      <!-- panel de edición -->
      <div
        class="lg:sticky lg:top-22 lg:block"
        :class="panelOpen ? 'fixed inset-x-0 bottom-0 z-50 max-h-[88dvh] lg:static lg:max-h-none' : 'hidden lg:block'"
      >
        <div v-if="panelOpen && form" class="bg-black/50 fixed inset-0 -z-10 lg:hidden" @click="form = null" />
        <AdminCard v-if="form" :pad="false" class="flex max-h-[88dvh] flex-col overflow-hidden lg:max-h-[calc(100dvh-7rem)]">
          <div class="border-default flex items-center justify-between border-b px-5 py-3.5">
            <div class="flex items-center gap-2.5">
              <UIcon :name="form.id ? 'i-lucide-pencil' : 'i-lucide-plus'" class="text-primary size-4" />
              <span class="font-display text-lg">{{ form.id ? 'Editar servicio' : 'Nuevo servicio' }}</span>
            </div>
            <button type="button" aria-label="Cerrar" class="text-dimmed flex size-7 items-center justify-center" @click="form = null"><UIcon name="i-lucide-x" class="size-[18px]" /></button>
          </div>

          <div class="flex-1 space-y-4 overflow-y-auto p-5">
            <UFormField label="Nombre del servicio"><UInput v-model="form.name" placeholder="Corte + barba" class="w-full" /></UFormField>
            <UFormField label="Descripción"><UTextarea v-model="form.description" :rows="2" placeholder="Servicio completo con perfilado" class="w-full" /></UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Duración (min)"><UInput v-model.number="form.durationMinutes" type="number" min="5" step="5" class="w-full" /></UFormField>
              <UFormField label="Precio (€)"><UInput v-model.number="form.basePrice" type="number" min="0" step="1" class="w-full" /></UFormField>
            </div>

            <div>
              <p class="text-dimmed mb-2 text-xs font-medium">Categoría</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="c in categories"
                  :key="c.id"
                  type="button"
                  class="rounded-full border px-3 py-1.5 text-xs font-semibold"
                  :class="form.category === c.id ? 'border-primary bg-primary text-inverted' : 'border-default bg-default text-toned'"
                  @click="form.category = c.id"
                >{{ c.name }}</button>
                <span v-if="!categories.length" class="text-dimmed text-xs">Crea una categoría primero (arriba).</span>
              </div>
            </div>

            <div>
              <p class="text-dimmed mb-2 text-xs font-medium">Barberos que lo ofrecen</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="b in barbers"
                  :key="b.id"
                  type="button"
                  class="flex size-10 items-center justify-center rounded-full border text-xs font-semibold"
                  :class="form.barberIds.includes(b.id) ? 'border-primary bg-primary/15 text-primary' : 'border-default bg-default text-dimmed'"
                  :title="b.name"
                  @click="toggleBarber(b.id)"
                >{{ initials(b.name) }}</button>
              </div>
            </div>

            <details class="border-default bg-default rounded-xl border px-3.5 py-2.5">
              <summary class="text-toned cursor-pointer text-xs font-medium">Precio por barbero (override)</summary>
              <div class="mt-3 space-y-2">
                <div v-for="b in barbers" :key="b.id" class="flex items-center gap-3">
                  <span class="size-2.5 rounded-full" :style="{ background: b.color }" />
                  <span class="flex-1 text-sm">{{ b.name }}</span>
                  <UInput v-model.number="form.priceOverrides[b.id]" type="number" min="0" :placeholder="String(form.basePrice)" class="w-20" />
                  <span class="text-dimmed text-sm">€</span>
                </div>
              </div>
            </details>

            <details class="border-default bg-default rounded-xl border px-3.5 py-2.5">
              <summary class="text-toned cursor-pointer text-xs font-medium">Duración por barbero (override)</summary>
              <div class="mt-3 space-y-2">
                <div v-for="b in barbers" :key="b.id" class="flex items-center gap-3">
                  <span class="size-2.5 rounded-full" :style="{ background: b.color }" />
                  <span class="flex-1 text-sm">{{ b.name }}</span>
                  <UInput v-model.number="form.durationOverrides[b.id]" type="number" min="5" step="5" :placeholder="String(form.durationMinutes)" class="w-20" />
                  <span class="text-dimmed text-sm">min</span>
                </div>
              </div>
            </details>

            <div class="border-default bg-default flex items-center justify-between rounded-xl border p-3">
              <div>
                <div class="text-sm font-semibold">Servicio activo</div>
                <div class="text-dimmed text-xs">Visible para reservar en la app</div>
              </div>
              <USwitch :model-value="!form.isPrivate" @update:model-value="form.isPrivate = !$event" />
            </div>
          </div>

          <div class="border-default flex items-center gap-2.5 border-t p-4">
            <UButton v-if="form.id" color="error" variant="ghost" icon="i-lucide-trash-2" @click="confirmRemove">Eliminar</UButton>
            <div class="flex-1" />
            <UButton color="primary" :loading="saving" icon="i-lucide-check" @click="save">Guardar</UButton>
          </div>
        </AdminCard>

        <!-- placeholder desktop -->
        <AdminCard v-else class="hidden text-center lg:block">
          <div class="py-10">
            <UIcon name="i-lucide-mouse-pointer-click" class="text-dimmed mx-auto size-7" />
            <p class="text-muted mt-3 text-sm">Selecciona un servicio para editarlo</p>
            <p class="text-dimmed text-xs">o pulsa “Añadir servicio”.</p>
          </div>
        </AdminCard>
      </div>
    </div>

    <AdminFab v-if="!panelOpen" label="Añadir servicio" @click="startCreate" />
  </div>
</template>
