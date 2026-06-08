<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { initials, fmtDate } from '~~/lib/format'
import { profileSchema, type ProfileInput } from '~~/schemas'
import { normalizePhone } from '~~/lib/phone'

definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Perfil' })

const toast = useToast()
const user = useCurrentUser()
const { client, isAdmin } = useCurrentClient()
const { signOut } = useAuth()
const { updateProfile } = useClients()
const { past } = useMyAppointments()
const { enabled: loyaltyEnabled, mySummary } = useLoyalty()

const { studio, name: studioName, waUrl } = useStudio()
const cityShort = computed(() => (studio.value.city || '').split(',')[0]!.trim())

const name = computed(() => client.value?.name || user.value?.displayName || 'Cliente')
const email = computed(() => client.value?.email || user.value?.email || '')
const phone = computed(() => client.value?.phone || '')
const memberSince = computed(() => {
  const c = client.value?.createdAt as unknown
  if (c && typeof (c as { toDate?: unknown }).toDate === 'function') {
    return fmtDate((c as { toDate: () => Date }).toDate(), 'yyyy')
  }
  return '2026'
})
const cortes = computed(() => past.value.filter((a) => a.status === 'completed').length || past.value.length)

// Contacto del estudio: WhatsApp si lo hay, si no email, si no teléfono.
const helpHref = computed(() => {
  if (waUrl.value) return waUrl.value
  if (studio.value.email) return `mailto:${studio.value.email}`
  if (studio.value.phone) return `tel:${studio.value.phone.replace(/\s/g, '')}`
  return ''
})

// Cada opción declara su destino: `action` (abre un modal), `to` (ruta interna) o
// `href` (enlace externo). El render elige el elemento adecuado.
const menu = computed(() => [
  { icon: 'i-lucide-user', label: 'Mis datos', sub: phone.value ? `${name.value} · ${phone.value}` : email.value, action: 'edit' as const, to: '', href: '' },
  { icon: 'i-lucide-bell', label: 'Notificaciones', sub: 'Recordatorios y avisos', to: '/avisos', href: '' },
  { icon: 'i-lucide-message-circle', label: 'Ayuda y contacto', sub: `Escríbenos${studio.value.whatsapp ? ' por WhatsApp' : ''}`, to: '', href: helpHref.value },
])

// — Modal "Mis datos" —
const editOpen = ref(false)
const editLoading = ref(false)
const editState = reactive<ProfileInput>({ name: '', phone: '', instagram: '', allowPush: false })

function openEdit() {
  editState.name = client.value?.name || user.value?.displayName || ''
  editState.phone = client.value?.phone || ''
  editState.instagram = client.value?.instagram || ''
  editState.allowPush = client.value?.allowPush ?? false
  editOpen.value = true
}

function onItemClick(item: { action?: 'edit' }) {
  if (item.action === 'edit') openEdit()
}

watch(
  () => editState.phone,
  (v) => {
    const clean = normalizePhone(v)
    if (clean !== v) editState.phone = clean
  },
)

async function onSaveProfile(event: FormSubmitEvent<ProfileInput>) {
  if (!user.value) return
  editLoading.value = true
  try {
    await updateProfile(user.value.uid, event.data)
    toast.add({ title: 'Datos actualizados', color: 'success', icon: 'i-lucide-check' })
    editOpen.value = false
  } catch {
    toast.add({ title: 'No se pudo guardar', color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    editLoading.value = false
  }
}
</script>

<template>
  <div class="contents">
  <!-- ====================== MÓVIL ====================== -->
  <div class="mx-auto flex w-full max-w-2xl flex-1 flex-col lg:hidden">
    <header class="flex items-center justify-between px-5 pt-5 pb-2 lg:pt-7">
      <h1 class="font-display text-3xl">Perfil</h1>
      <UIcon name="i-lucide-sliders-horizontal" class="text-muted size-5" />
    </header>

    <div class="flex-1 space-y-5 px-5 py-4">
      <!-- identidad -->
      <div class="flex items-center gap-4">
        <div class="border-primary/40 bg-elevated flex size-16 items-center justify-center rounded-full border text-lg font-semibold">
          {{ initials(name) }}
        </div>
        <div class="flex-1">
          <p class="font-display text-2xl leading-none">{{ name }}</p>
          <p class="text-muted mt-1 text-xs">Miembro desde {{ memberSince }}<template v-if="cityShort"> · {{ cityShort }}</template></p>
        </div>
      </div>

      <!-- tarjeta socio (programa de fidelización; solo si está activo) -->
      <NuxtLink
        v-if="loyaltyEnabled"
        to="/socio"
        class="border-primary/30 relative block overflow-hidden rounded-2xl border p-5"
        style="background: linear-gradient(135deg, var(--jdvm-bg-2), var(--jdvm-bg-1))"
      >
        <div class="mb-4 flex items-center justify-between">
          <AppLogo variant="mark" :size="18" />
          <span class="text-primary font-mono text-[0.6rem] tracking-widest uppercase">Socio · {{ mySummary.tier.name }}</span>
        </div>
        <div class="flex items-end justify-between">
          <div>
            <p class="font-display text-4xl leading-none">{{ mySummary.balance }}</p>
            <p class="text-muted mt-1 text-[0.7rem]">
              {{ mySummary.nextTier ? `puntos · ${mySummary.toNextTier} para ${mySummary.nextTier.name}` : 'puntos · nivel máximo' }}
            </p>
          </div>
          <div class="text-right">
            <p class="text-primary font-display text-2xl leading-none">{{ cortes }}</p>
            <p class="text-muted mt-0.5 text-[0.7rem]">cortes</p>
          </div>
        </div>
        <div class="bg-default mt-3.5 h-1.5 overflow-hidden rounded-full">
          <div class="bg-primary h-full rounded-full" :style="{ width: `${Math.round(mySummary.progress * 100)}%` }" />
        </div>
      </NuxtLink>

      <!-- acceso al panel (solo admin) -->
      <NuxtLink
        v-if="isAdmin"
        to="/admin"
        class="border-primary/30 bg-primary/10 flex items-center gap-3 rounded-2xl border p-4"
      >
        <div class="bg-primary/20 flex size-9 items-center justify-center rounded-lg">
          <UIcon name="i-lucide-layout-dashboard" class="text-primary size-4.5" />
        </div>
        <div class="flex-1">
          <p class="text-sm font-semibold">Panel de administración</p>
          <p class="text-muted text-xs">Agenda, clientes, equipo y catálogo</p>
        </div>
        <UIcon name="i-lucide-chevron-right" class="text-primary size-4" />
      </NuxtLink>

      <!-- menú -->
      <div class="border-default overflow-hidden rounded-2xl border">
        <component
          :is="item.to ? 'NuxtLink' : item.href ? 'a' : 'button'"
          v-for="(item, i) in menu"
          :key="item.label"
          :to="item.to || undefined"
          :href="item.href || undefined"
          :target="item.href && item.href.startsWith('http') ? '_blank' : undefined"
          :rel="item.href && item.href.startsWith('http') ? 'noopener' : undefined"
          type="button"
          class="flex w-full items-center gap-3 px-4 py-3.5 text-left"
          :class="i ? 'border-default border-t' : ''"
          @click="onItemClick(item)"
        >
          <div class="bg-elevated flex size-8 items-center justify-center rounded-lg">
            <UIcon :name="item.icon" class="text-primary size-4" />
          </div>
          <span class="flex-1 text-sm font-medium">{{ item.label }}</span>
          <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4" />
        </component>
      </div>

      <NotificationToggle />

      <UButton color="error" variant="outline" size="lg" block icon="i-lucide-log-out" @click="signOut">
        Cerrar sesión
      </UButton>

      <p class="text-dimmed text-center font-mono text-[0.6rem]">{{ studioName }} · v0.1.0</p>
    </div>
  </div>

  <!-- ====================== ESCRITORIO ====================== -->
  <div class="mx-auto hidden w-full max-w-[1280px] flex-1 flex-col px-8 py-10 lg:flex">
    <h1 class="font-display mb-7 text-4xl">Mi cuenta</h1>

    <div class="grid grid-cols-[1fr_1.5fr] items-start gap-6">
      <!-- columna izquierda: identidad + socio -->
      <div class="space-y-5">
        <div class="border-default bg-muted rounded-[18px] border p-7 text-center">
          <div class="relative mx-auto w-[88px]">
            <div class="border-primary/40 bg-elevated flex size-[88px] items-center justify-center rounded-full border text-2xl font-semibold">
              {{ initials(name) }}
            </div>
            <span class="bg-primary border-muted absolute right-0 bottom-0 flex size-7 items-center justify-center rounded-full border-[3px]">
              <UIcon name="i-lucide-camera" class="text-inverted size-3.5" />
            </span>
          </div>
          <p class="font-display mt-4 text-2xl leading-none">{{ name }}</p>
          <p class="text-dimmed mt-1.5 text-xs">Miembro desde {{ memberSince }}<template v-if="cityShort"> · {{ cityShort }}</template></p>
          <div class="border-default mt-5 flex border-t pt-4">
            <div class="flex-1">
              <p class="font-display text-2xl">{{ cortes }}</p>
              <p class="text-dimmed mt-0.5 text-[0.7rem]">Cortes</p>
            </div>
            <div v-if="loyaltyEnabled" class="border-default flex-1 border-l">
              <p class="font-display text-2xl">{{ mySummary.balance }}</p>
              <p class="text-dimmed mt-0.5 text-[0.7rem]">Puntos</p>
            </div>
            <div class="border-default flex-1 border-l">
              <p class="font-display text-2xl">{{ past.length }}</p>
              <p class="text-dimmed mt-0.5 text-[0.7rem]">Visitas</p>
            </div>
          </div>
        </div>

        <NuxtLink
          v-if="loyaltyEnabled"
          to="/socio"
          class="border-primary/30 block overflow-hidden rounded-[18px] border p-6"
          style="background: linear-gradient(135deg, var(--jdvm-bg-2), var(--jdvm-bg-1))"
        >
          <div class="mb-4 flex items-center justify-between">
            <span class="text-primary font-mono text-[0.6rem] tracking-widest uppercase">Socio · {{ mySummary.tier.name }}</span>
            <UIcon name="i-lucide-award" class="text-primary size-4" />
          </div>
          <p class="font-display text-4xl leading-none">{{ mySummary.balance }} <span class="text-muted text-base">pts</span></p>
          <p class="text-muted mt-1.5 text-xs">
            {{ mySummary.nextTier ? `${mySummary.toNextTier} puntos para ${mySummary.nextTier.name}` : 'Has alcanzado el nivel máximo' }}
          </p>
          <div class="bg-default mt-3.5 h-1.5 overflow-hidden rounded-full">
            <div class="bg-primary h-full rounded-full" :style="{ width: `${Math.round(mySummary.progress * 100)}%` }" />
          </div>
        </NuxtLink>
      </div>

      <!-- columna derecha: ajustes + acciones -->
      <div class="space-y-5">
        <NuxtLink
          v-if="isAdmin"
          to="/admin"
          class="border-primary/30 bg-primary/10 flex items-center gap-3 rounded-2xl border p-4"
        >
          <div class="bg-primary/20 flex size-9 items-center justify-center rounded-lg">
            <UIcon name="i-lucide-layout-dashboard" class="text-primary size-4.5" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold">Panel de administración</p>
            <p class="text-muted text-xs">Agenda, clientes, equipo y catálogo</p>
          </div>
          <UIcon name="i-lucide-chevron-right" class="text-primary size-4" />
        </NuxtLink>

        <div class="border-default bg-muted overflow-hidden rounded-2xl border">
          <div class="border-default font-display border-b px-6 py-4 text-xl">Ajustes de la cuenta</div>
          <component
            :is="item.to ? 'NuxtLink' : item.href ? 'a' : 'button'"
            v-for="(item, i) in menu"
            :key="item.label"
            :to="item.to || undefined"
            :href="item.href || undefined"
            :target="item.href && item.href.startsWith('http') ? '_blank' : undefined"
            :rel="item.href && item.href.startsWith('http') ? 'noopener' : undefined"
            type="button"
            class="flex w-full items-center gap-4 px-6 py-4 text-left"
            :class="i ? 'border-default border-t' : ''"
            @click="onItemClick(item)"
          >
            <div class="bg-elevated flex size-10 shrink-0 items-center justify-center rounded-xl">
              <UIcon :name="item.icon" class="text-primary size-[18px]" />
            </div>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold">{{ item.label }}</p>
              <p class="text-dimmed truncate text-xs">{{ item.sub }}</p>
            </div>
            <UIcon name="i-lucide-chevron-right" class="text-dimmed size-4" />
          </component>
        </div>

        <NotificationToggle />

        <div class="flex items-center justify-end">
          <UButton color="neutral" variant="outline" icon="i-lucide-log-out" @click="signOut">Cerrar sesión</UButton>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal: editar mis datos -->
  <UModal v-model:open="editOpen" title="Mis datos">
    <template #body>
      <UForm :schema="profileSchema" :state="editState" class="flex flex-col gap-4" @submit="onSaveProfile">
        <UFormField label="Nombre" name="name">
          <UInput v-model="editState.name" placeholder="Tu nombre" icon="i-lucide-user" size="lg" class="w-full" />
        </UFormField>

        <UFormField label="Teléfono" name="phone" help="9 dígitos, sin prefijo.">
          <UInput
            v-model="editState.phone"
            type="tel"
            inputmode="numeric"
            placeholder="600 000 000"
            icon="i-lucide-phone"
            size="lg"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Instagram" name="instagram" help="Opcional.">
          <UInput v-model="editState.instagram" placeholder="@usuario" icon="i-lucide-instagram" size="lg" class="w-full" />
        </UFormField>

        <div class="border-default text-muted mt-1 border-t pt-3 text-xs">
          Email: <span class="text-toned">{{ email }}</span>
        </div>

        <div class="mt-1 flex justify-end gap-2">
          <UButton color="neutral" variant="ghost" @click="editOpen = false">Cancelar</UButton>
          <UButton type="submit" color="primary" :loading="editLoading">Guardar</UButton>
        </div>
      </UForm>
    </template>
  </UModal>
  </div>
</template>
