<script setup lang="ts">
import { WEEKDAYS, type Weekday, type WeekTimetable, type ThemeKey } from '~~/schemas'
import { BRAND_THEMES, EXTRA_THEME_KEYS } from '~~/lib/themes'

// Las 6 paletas principales y las extra (ocultas tras "Más paletas").
const PRIMARY_THEMES = BRAND_THEMES.filter((t) => !EXTRA_THEME_KEYS.includes(t.key))
const EXTRA_THEMES = BRAND_THEMES.filter((t) => EXTRA_THEME_KEYS.includes(t.key))
const showExtraThemes = ref(false)

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Ajustes · Admin' })

const { settings, save } = useSettings()
const { active: activeBarbers } = useBarbers()
const toast = useToast()

// Paleta realmente guardada (no la previsualizada). Se usa para restaurar al salir
// si hay una preview sin guardar. Evita la carrera con settings.value (que llega
// con retraso tras guardar y revertía la paleta nueva al salir de la página).
const savedTheme = ref<ThemeKey>('forest')
const themeCookie = useCookie<string>(THEME_COOKIE, { maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })

const DAY_LABELS: Record<Weekday, string> = {
  mon: 'Lun', tue: 'Mar', wed: 'Mié', thu: 'Jue', fri: 'Vie', sat: 'Sáb', sun: 'Dom',
}
const STEPS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 60]

const form = reactive({
  slotStepMinutes: 15,
  cancellationWindowHours: 4,
  defaultBarberId: '',
  daysClosed: [] as Weekday[],
  acceptingAppointments: true,
  acceptingCancellations: true,
  timetable: {} as WeekTimetable,
  theme: 'forest' as ThemeKey,
  studio: {
    name: 'JDVM Hair Studio',
    city: '',
    phone: '',
    email: '',
    whatsapp: '',
    address: '',
    instagram: '',
    facebook: '',
    tiktok: '',
    mapsUrl: '',
    foundedYear: 2018,
  },
})

// Marca (logos + vídeo del hero): subida inmediata a Storage, fuera del formulario.
type AssetKind = 'logo' | 'logoMark' | 'heroVideo'
const { studio: studioInfo, uploadAsset, removeAsset } = useStudio()
const logoInput = useTemplateRef<HTMLInputElement>('logoInput')
const markInput = useTemplateRef<HTMLInputElement>('markInput')
const videoInput = useTemplateRef<HTMLInputElement>('videoInput')
const assetBusy = ref<AssetKind | null>(null)
const ASSET_LABEL: Record<AssetKind, string> = { logo: 'Logo', logoMark: 'Emblema', heroVideo: 'Vídeo del hero' }
async function onAssetFile(e: Event, kind: AssetKind) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  assetBusy.value = kind
  try {
    await uploadAsset(file, kind)
    toast.add({ title: `${ASSET_LABEL[kind]} actualizado`, icon: 'i-lucide-check', color: 'success' })
  } catch (err) {
    toast.add({ title: 'No se pudo subir', description: (err as Error).message, color: 'error' })
  } finally {
    assetBusy.value = null
  }
}

// Cargar settings cuando llegan.
watch(
  settings,
  (s) => {
    if (!s) return
    form.slotStepMinutes = s.slotStepMinutes ?? 15
    form.cancellationWindowHours = s.cancellationWindowHours ?? 4
    form.defaultBarberId = s.defaultBarberId ?? ''
    form.daysClosed = [...(s.daysClosed ?? [])]
    form.acceptingAppointments = s.acceptingAppointments ?? true
    form.acceptingCancellations = s.acceptingCancellations ?? true
    form.timetable = structuredClone(toRaw(s.timetable ?? {}))
    form.theme = s.theme ?? 'forest'
    savedTheme.value = s.theme ?? 'forest'
    if (EXTRA_THEME_KEYS.includes(form.theme)) showExtraThemes.value = true
    form.studio = {
      name: s.studio?.name ?? 'JDVM Hair Studio',
      city: s.studio?.city ?? '',
      phone: s.studio?.phone ?? '',
      email: s.studio?.email ?? '',
      whatsapp: s.studio?.whatsapp ?? '',
      address: s.studio?.address ?? '',
      instagram: s.studio?.instagram ?? '',
      facebook: s.studio?.facebook ?? '',
      tiktok: s.studio?.tiktok ?? '',
      mapsUrl: s.studio?.mapsUrl ?? '',
      foundedYear: s.studio?.foundedYear ?? 2018,
    }
  },
  { immediate: true },
)

// Vista previa en vivo: al elegir una paleta, se aplica al instante a toda la
// app. El cambio se persiste (para todos) al pulsar Guardar; si se sale sin
// guardar, vuelve a la paleta guardada al recargar.
function previewTheme(key: ThemeKey) {
  form.theme = key
  applyBrandTheme(key)
}

// Si se sale con una previsualización sin guardar, restaura la paleta guardada.
onBeforeUnmount(() => {
  if (form.theme !== savedTheme.value) applyBrandTheme(savedTheme.value)
})

function toggleClosed(d: Weekday) {
  const i = form.daysClosed.indexOf(d)
  if (i >= 0) form.daysClosed.splice(i, 1)
  else form.daysClosed.push(d)
}

const saving = ref(false)
async function submit() {
  saving.value = true
  try {
    await save({
      slotStepMinutes: form.slotStepMinutes,
      cancellationWindowHours: Math.max(1, Number(form.cancellationWindowHours) || 4),
      defaultBarberId: form.defaultBarberId,
      daysClosed: form.daysClosed,
      acceptingAppointments: form.acceptingAppointments,
      acceptingCancellations: form.acceptingCancellations,
      timetable: form.timetable,
      theme: form.theme,
      // Mezcla con los campos de logo (que se gestionan aparte) para no perderlos.
      studio: { ...studioInfo.value, ...form.studio, foundedYear: Number(form.studio.foundedYear) || 2018 },
    })
    // La paleta ya es la guardada: fíjala como tal, aplícala y persiste la cookie
    // de inmediato (sin esperar a que la snapshot de Firestore vuelva).
    savedTheme.value = form.theme
    themeCookie.value = form.theme
    applyBrandTheme(form.theme)
    toast.add({ title: 'Ajustes guardados', icon: 'i-lucide-check', color: 'success' })
  } catch (e) {
    toast.add({ title: 'No se pudo guardar', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div>
    <AdminHeader title="Ajustes" sub="Horario, reservas y franjas del estudio">
      <template #actions>
        <UButton color="primary" icon="i-lucide-check" :loading="saving" @click="submit">Guardar</UButton>
      </template>
    </AdminHeader>

    <div class="grid max-w-4xl gap-4 px-5 py-6 pb-24 lg:px-7 lg:pb-6">
      <!-- notificaciones push de este dispositivo (avisos de citas y cancelaciones) -->
      <NotificationToggle />

      <!-- información del estudio (toda la app) -->
      <AdminCard>
        <h2 class="font-display text-lg">Información del estudio</h2>
        <p class="text-muted mt-1 text-sm">Nombre, contacto y ubicación. Se usan en toda la app (web, cliente, títulos, footer).</p>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <UFormField label="Nombre"><UInput v-model="form.studio.name" placeholder="Mi Barbería" class="w-full" /></UFormField>
          <UFormField label="Ciudad / zona" help="P. ej. 'Maracena, Granada'"><UInput v-model="form.studio.city" placeholder="Ciudad, provincia" class="w-full" /></UFormField>
          <UFormField label="Teléfono"><UInput v-model="form.studio.phone" placeholder="600 00 00 00" class="w-full" /></UFormField>
          <UFormField label="Email"><UInput v-model="form.studio.email" type="email" placeholder="hola@mibarberia.com" class="w-full" /></UFormField>
          <UFormField label="WhatsApp" help="Número con prefijo o enlace"><UInput v-model="form.studio.whatsapp" placeholder="+34 600 00 00 00" class="w-full" /></UFormField>
          <UFormField label="Año de apertura"><UInput v-model.number="form.studio.foundedYear" type="number" min="1950" :max="new Date().getFullYear()" class="w-full" /></UFormField>
          <UFormField label="Dirección" class="sm:col-span-2"><UInput v-model="form.studio.address" placeholder="C/ Ejemplo 12, 18000 Ciudad" class="w-full" /></UFormField>
          <UFormField label="Instagram" help="Usuario (@mibarberia) o URL"><UInput v-model="form.studio.instagram" placeholder="@mibarberia" class="w-full" /></UFormField>
          <UFormField label="Facebook" help="Usuario o URL"><UInput v-model="form.studio.facebook" placeholder="mibarberia" class="w-full" /></UFormField>
          <UFormField label="TikTok" help="Usuario o URL"><UInput v-model="form.studio.tiktok" placeholder="@mibarberia" class="w-full" /></UFormField>
          <UFormField label="Enlace de Google Maps"><UInput v-model="form.studio.mapsUrl" placeholder="https://maps.google.com/..." class="w-full" /></UFormField>
        </div>
      </AdminCard>

      <!-- logos + vídeo (subida inmediata) -->
      <AdminCard>
        <h2 class="font-display text-lg">Logo y vídeo</h2>
        <p class="text-muted mt-1 text-sm">Sube tu marca. Si no subes nada, se usan los recursos por defecto.</p>
        <div class="mt-4 grid gap-4 sm:grid-cols-2">
          <div class="border-default rounded-xl border p-4">
            <p class="text-sm font-semibold">Logo completo</p>
            <p class="text-dimmed mb-3 text-xs">Para barras grandes y la web (PNG con fondo transparente).</p>
            <div class="bg-default border-default mb-3 flex h-16 items-center justify-center rounded-lg border">
              <img v-if="studioInfo.logoUrl" :src="studioInfo.logoUrl" alt="Logo" class="max-h-12 w-auto" />
              <span v-else class="text-dimmed text-xs">Sin logo (por defecto)</span>
            </div>
            <input ref="logoInput" type="file" accept="image/*" class="hidden" @change="onAssetFile($event, 'logo')" />
            <div class="flex gap-2">
              <UButton size="sm" color="primary" variant="soft" icon="i-lucide-upload" :loading="assetBusy === 'logo'" @click="logoInput?.click()">Subir</UButton>
              <UButton v-if="studioInfo.logoUrl" size="sm" color="error" variant="ghost" icon="i-lucide-trash-2" @click="removeAsset('logo')">Quitar</UButton>
            </div>
          </div>
          <div class="border-default rounded-xl border p-4">
            <p class="text-sm font-semibold">Emblema</p>
            <p class="text-dimmed mb-3 text-xs">Versión compacta para barras pequeñas. Si no hay, se usa el completo.</p>
            <div class="bg-default border-default mb-3 flex h-16 items-center justify-center rounded-lg border">
              <img v-if="studioInfo.logoMarkUrl" :src="studioInfo.logoMarkUrl" alt="Emblema" class="max-h-12 w-auto" />
              <span v-else class="text-dimmed text-xs">Sin emblema (por defecto)</span>
            </div>
            <input ref="markInput" type="file" accept="image/*" class="hidden" @change="onAssetFile($event, 'logoMark')" />
            <div class="flex gap-2">
              <UButton size="sm" color="primary" variant="soft" icon="i-lucide-upload" :loading="assetBusy === 'logoMark'" @click="markInput?.click()">Subir</UButton>
              <UButton v-if="studioInfo.logoMarkUrl" size="sm" color="error" variant="ghost" icon="i-lucide-trash-2" @click="removeAsset('logoMark')">Quitar</UButton>
            </div>
          </div>
          <div class="border-default rounded-xl border p-4 sm:col-span-2">
            <p class="text-sm font-semibold">Vídeo del hero</p>
            <p class="text-dimmed mb-3 text-xs">Se muestra en la portada de la web y en la home de la app (móvil). Vertical, mudo, en bucle. Si no subes, se usa el vídeo por defecto.</p>
            <div class="bg-default border-default mb-3 overflow-hidden rounded-lg border">
              <video v-if="studioInfo.heroVideoUrl" :src="studioInfo.heroVideoUrl" class="mx-auto max-h-40" muted loop autoplay playsinline />
              <div v-else class="text-dimmed flex h-20 items-center justify-center text-xs">Sin vídeo (por defecto)</div>
            </div>
            <input ref="videoInput" type="file" accept="video/*" class="hidden" @change="onAssetFile($event, 'heroVideo')" />
            <div class="flex gap-2">
              <UButton size="sm" color="primary" variant="soft" icon="i-lucide-upload" :loading="assetBusy === 'heroVideo'" @click="videoInput?.click()">Subir vídeo</UButton>
              <UButton v-if="studioInfo.heroVideoUrl" size="sm" color="error" variant="ghost" icon="i-lucide-trash-2" @click="removeAsset('heroVideo')">Quitar</UButton>
            </div>
          </div>
        </div>
      </AdminCard>

      <!-- paleta de marca -->
      <AdminCard>
        <h2 class="font-display text-lg">Paleta de la app</h2>
        <p class="text-muted mt-1 text-sm">
          La identidad de color de toda la app (web pública, cliente, barbero y admin).
          Al elegir una se previsualiza al instante; pulsa <b>Guardar</b> para aplicarla a todos.
        </p>
        <div class="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            v-for="t in PRIMARY_THEMES"
            :key="t.key"
            type="button"
            class="group relative overflow-hidden rounded-xl border text-left transition"
            :class="form.theme === t.key ? 'border-primary ring-primary/40 ring-2' : 'border-default hover:border-primary/50'"
            @click="previewTheme(t.key as ThemeKey)"
          >
            <!-- muestra de la paleta -->
            <div class="flex h-16 w-full items-end gap-1.5 p-2.5" :style="{ background: t.bg1 }">
              <span class="h-7 flex-1 rounded-md" :style="{ background: t.bg2, border: `1px solid ${t.border}` }" />
              <span class="h-9 w-9 rounded-md" :style="{ background: t.accent }" />
              <span class="h-5 w-5 rounded-full" :style="{ background: t.fg0 }" />
            </div>
            <div class="border-default flex items-center justify-between gap-2 border-t px-3 py-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">{{ t.name }}</p>
                <p class="text-dimmed truncate text-[11px]">{{ t.tagline }}</p>
              </div>
              <UIcon
                v-if="form.theme === t.key"
                name="i-lucide-check-circle-2"
                class="text-primary size-5 shrink-0"
              />
            </div>
          </button>
        </div>

        <!-- paletas extra, ocultas tras un desplegable -->
        <button
          type="button"
          class="text-muted hover:text-toned mt-4 inline-flex items-center gap-1.5 text-sm font-semibold transition"
          @click="showExtraThemes = !showExtraThemes"
        >
          <UIcon :name="showExtraThemes ? 'i-lucide-chevron-down' : 'i-lucide-chevron-right'" class="size-4" />
          {{ showExtraThemes ? 'Menos paletas' : 'Más paletas' }}
        </button>
        <div v-if="showExtraThemes" class="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <button
            v-for="t in EXTRA_THEMES"
            :key="t.key"
            type="button"
            class="group relative overflow-hidden rounded-xl border text-left transition"
            :class="form.theme === t.key ? 'border-primary ring-primary/40 ring-2' : 'border-default hover:border-primary/50'"
            @click="previewTheme(t.key as ThemeKey)"
          >
            <div class="flex h-16 w-full items-end gap-1.5 p-2.5" :style="{ background: t.bg1 }">
              <span class="h-7 flex-1 rounded-md" :style="{ background: t.bg2, border: `1px solid ${t.border}` }" />
              <span class="h-9 w-9 rounded-md" :style="{ background: t.accent }" />
              <span class="h-5 w-5 rounded-full" :style="{ background: t.fg0 }" />
            </div>
            <div class="border-default flex items-center justify-between gap-2 border-t px-3 py-2">
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold">{{ t.name }}</p>
                <p class="text-dimmed truncate text-[11px]">{{ t.tagline }}</p>
              </div>
              <UIcon
                v-if="form.theme === t.key"
                name="i-lucide-check-circle-2"
                class="text-primary size-5 shrink-0"
              />
            </div>
          </button>
        </div>
      </AdminCard>

      <!-- granularidad -->
      <AdminCard>
        <h2 class="font-display text-lg">Granularidad de las franjas</h2>
        <p class="text-muted mt-1 text-sm">Cada cuántos minutos se ofrece un hueco de reserva. Más pequeño = más opciones.</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="s in STEPS"
            :key="s"
            type="button"
            class="rounded-full border px-4 py-2 text-sm font-semibold"
            :class="form.slotStepMinutes === s ? 'border-primary bg-primary text-inverted' : 'border-default bg-muted text-toned'"
            @click="form.slotStepMinutes = s"
          >
            {{ s }} min
          </button>
        </div>
      </AdminCard>

      <!-- barbero por defecto al reservar -->
      <AdminCard>
        <h2 class="font-display text-lg">Barbero por defecto</h2>
        <p class="text-muted mt-1 text-sm">El que aparece preseleccionado al reservar (en vez de "cualquiera disponible"). El cliente puede cambiarlo.</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-full border px-4 py-2 text-sm font-semibold"
            :class="!form.defaultBarberId ? 'border-primary bg-primary text-inverted' : 'border-default bg-muted text-toned'"
            @click="form.defaultBarberId = ''"
          >
            Cualquiera
          </button>
          <button
            v-for="b in activeBarbers"
            :key="b.id"
            type="button"
            class="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
            :class="form.defaultBarberId === b.id ? 'border-primary bg-primary text-inverted' : 'border-default bg-muted text-toned'"
            @click="form.defaultBarberId = b.id"
          >
            <span class="size-2.5 rounded-full" :style="{ background: b.color }" />
            {{ b.name }}
          </button>
        </div>
      </AdminCard>

      <!-- ventana de cancelación -->
      <AdminCard>
        <h2 class="font-display text-lg">Antelación para cancelar</h2>
        <p class="text-muted mt-1 text-sm">Horas mínimas antes de la cita para que el cliente pueda cancelar o reprogramar. El admin siempre puede.</p>
        <div class="mt-4 flex items-center gap-3">
          <UInput v-model.number="form.cancellationWindowHours" type="number" min="1" max="168" class="w-28" />
          <span class="text-dimmed text-sm">horas antes</span>
        </div>
      </AdminCard>

      <!-- reservas -->
      <AdminCard :pad="false">
        <div class="flex items-center justify-between p-5">
          <div>
            <p class="text-sm font-semibold">Aceptar reservas</p>
            <p class="text-dimmed text-xs">Si lo desactivas, los clientes no pueden reservar.</p>
          </div>
          <USwitch v-model="form.acceptingAppointments" />
        </div>
        <div class="border-default flex items-center justify-between border-t p-5">
          <div>
            <p class="text-sm font-semibold">Aceptar cancelaciones</p>
            <p class="text-dimmed text-xs">Permite cancelar/reprogramar hasta {{ form.cancellationWindowHours }} h antes.</p>
          </div>
          <USwitch v-model="form.acceptingCancellations" />
        </div>
      </AdminCard>

      <!-- días cerrados -->
      <AdminCard>
        <h2 class="font-display text-lg">Días cerrados</h2>
        <p class="text-muted mt-1 text-sm">El estudio no abre estos días (no se ofrecen huecos).</p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button
            v-for="d in WEEKDAYS"
            :key="d"
            type="button"
            class="rounded-xl border px-3.5 py-2 text-sm font-semibold"
            :class="form.daysClosed.includes(d) ? 'border-error/40 bg-error/10 text-error' : 'border-default bg-muted text-toned'"
            @click="toggleClosed(d)"
          >
            {{ DAY_LABELS[d] }}
          </button>
        </div>
      </AdminCard>

      <!-- horario del local -->
      <AdminCard>
        <h2 class="font-display text-lg">Horario de apertura</h2>
        <p class="text-muted mt-1 mb-4 text-sm">Franja general del local por día (mañana y/o tarde).</p>
        <WeekTimetableEditor v-model="form.timetable" />
      </AdminCard>
    </div>
  </div>
</template>
