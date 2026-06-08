<script setup lang="ts">
import { formatDuration, initials } from '~~/lib/format'
import { formatDayHours, openStatus, resolveDayTimetable } from '~~/lib/slots'
import { weekdayOf, toDate } from '~~/lib/datetime'
import { WEEKDAYS, type Weekday } from '~~/schemas'

const { settings } = useSettings()
const { publicServices } = useServices()
const { categories } = useServiceCategories()
const { active: barbers } = useBarbers()
const { reviews } = useReviews()
const { images } = useImages()
const { studio, heroVideo, fbUrl, tiktokUrl } = useStudio()

const cityLabel = computed(() => studio.value.city || studio.value.address || '')
const cityShort = computed(() => (studio.value.city || '').split(',')[0]!.trim())

useHead(() => ({
  title: studio.value.city ? `Barbería en ${studio.value.city.split(',')[0]}` : 'Barbería',
  meta: [
    {
      name: 'description',
      content: `${studio.value.name} — barbería${cityLabel.value ? ` en ${cityLabel.value}` : ''} desde ${studio.value.foundedYear}. Reserva tu corte, barba o ritual completo con tu barbero de siempre.`,
    },
  ],
}))

const menuOpen = ref(false)

const NAV = [
  { label: 'Servicios', to: '#servicios' },
  { label: 'El estudio', to: '#estudio' },
  { label: 'Equipo', to: '#equipo' },
  { label: 'Visítanos', to: '#visitanos' },
]

// Hora actual: solo en cliente para no romper la hidratación (abierto/cerrado).
const now = ref<Date | null>(null)
onMounted(() => {
  now.value = new Date()
})

// El año de fundación es estable entre SSR y cliente (no depende de la hora).
const currentYear = new Date().getFullYear()
const years = computed(() => Math.max(1, currentYear - studio.value.foundedYear))

const avgRating = computed(() => {
  const list = reviews.value
  if (!list.length) return 0
  return list.reduce((s, r) => s + r.score, 0) / list.length
})

const HERO_META = computed(() => [
  {
    n: avgRating.value ? avgRating.value.toFixed(1).replace('.', ',') : '5,0',
    l: reviews.value.length ? `★ en ${reviews.value.length} reseñas` : '★ valoración media',
  },
  { n: String(barbers.value.length || 0), l: barbers.value.length === 1 ? 'barbero en plantilla' : 'barberos en plantilla' },
  { n: String(years.value), l: years.value === 1 ? 'año en el barrio' : 'años en el barrio' },
])

// Carta agrupada por categorías configurables (mismo criterio que /carta).
const CARTA = computed(() => {
  const known = new Set(categories.value.map((c) => c.id))
  const list = categories.value.map((c) => ({
    cat: c.name,
    items: publicServices.value.filter((s) => s.category === c.id),
  }))
  const orphans = publicServices.value.filter((s) => !s.category || !known.has(s.category))
  if (orphans.length) list.push({ cat: 'Otros', items: orphans })
  return list.filter((g) => g.items.length)
})

// Galería real (Storage); si no hay imágenes, tiras de placeholder a rayas.
const GALLERY_CLS = ['row-span-2', '', 'col-span-2', '', 'col-span-2', 'row-span-2', '', '']
const GALLERY = computed(() => {
  if (images.value.length) {
    return images.value.slice(0, 8).map((img, i) => ({
      src: img.url,
      label: img.caption || 'trabajo',
      cls: GALLERY_CLS[i % GALLERY_CLS.length],
    }))
  }
  return GALLERY_CLS.map((cls, i) => ({ src: null as string | null, label: ['fade', 'barba', 'navaja', 'textura', 'estudio', 'pompadour', 'afeitado', 'color'][i], cls }))
})

const serviceName = (id: string) => publicServices.value.find((s) => s.id === id)?.name

// Equipo = barberos activos, con sus servicios como etiquetas y su valoración real.
const TEAM = computed(() =>
  barbers.value.map((b) => {
    const list = reviews.value.filter((r) => r.barberId === b.id)
    const avg = list.length ? list.reduce((s, r) => s + r.score, 0) / list.length : 0
    return {
      id: b.id,
      slug: b.slug,
      name: b.name,
      photoUrl: b.photoUrl || null,
      bio: b.bio || `Barbero del equipo ${studio.value.name}.`,
      role: list.length ? `${avg.toFixed(1).replace('.', ',')} ★ · ${list.length} reseñas` : (cityShort.value ? `Barbero · ${cityShort.value}` : 'Barbero'),
      tags: (b.servicesOffered ?? []).map(serviceName).filter(Boolean).slice(0, 3) as string[],
    }
  }),
)

// Testimonios = reseñas reales con texto, las mejor valoradas primero.
const TESTIMONIALS = computed(() =>
  reviews.value
    .filter((r) => r.text && r.text.trim())
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((r) => {
      const year = r.createdAt ? toDate(r.createdAt).getFullYear() : null
      return {
        av: initials(r.clientName),
        nm: r.clientName || 'Cliente',
        mt: year ? `Cliente desde ${year}` : 'Cliente',
        q: r.text as string,
        score: r.score,
      }
    }),
)

// Horario semanal desde settings (timetable + días cerrados).
const DAY_LABELS: Record<Weekday, string> = {
  mon: 'Lunes', tue: 'Martes', wed: 'Miércoles', thu: 'Jueves', fri: 'Viernes', sat: 'Sábado', sun: 'Domingo',
}
const todayWd = computed(() => (now.value ? weekdayOf(now.value) : null))
const HOURS = computed(() =>
  WEEKDAYS.map((wd) => {
    const closed = settings.value?.daysClosed?.includes(wd) ?? false
    const h = closed ? 'Cerrado' : formatDayHours(settings.value?.timetable?.[wd])
    const today = todayWd.value === wd
    return { d: DAY_LABELS[wd] + (today ? ' · hoy' : ''), h, today }
  }),
)

// Estado en vivo del local (para el badge del hero).
const openNow = computed(() => {
  if (!now.value || !settings.value) return null
  if (settings.value.daysClosed?.includes(weekdayOf(now.value))) return { open: false }
  return openStatus(resolveDayTimetable(settings.value.timetable ?? {}, now.value), now.value)
})

const igUrl = computed(() => {
  const h = studio.value.instagram
  if (!h) return ''
  if (h.startsWith('http')) return h
  return `https://instagram.com/${h.replace(/^@/, '')}`
})
</script>

<template>
  <div class="bg-default text-default relative scroll-smooth font-sans">
    <UiGrain :opacity="0.35" />

    <!-- NAV -->
    <header class="border-default bg-default/80 sticky top-0 z-40 border-b backdrop-blur">
      <div class="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-3.5 sm:px-8">
        <a href="#top" :aria-label="`${studio.name} inicio`" class="flex items-center gap-2.5">
          <AppLogo variant="mark" :size="30" />
          <span class="flex flex-col leading-none">
            <span class="font-display text-xl tracking-wide">{{ studio.name }}</span>
            <span class="text-primary mt-1 font-mono text-[0.55rem] tracking-[0.22em] uppercase">Barbería<template v-if="cityShort"> · {{ cityShort }}</template></span>
          </span>
        </a>
        <nav class="hidden items-center gap-7 lg:flex">
          <a v-for="n in NAV" :key="n.to" :href="n.to" class="text-muted hover:text-default text-sm font-medium transition-colors">{{ n.label }}</a>
        </nav>
        <div class="flex items-center gap-3">
          <a v-if="studio.phone" :href="`tel:${studio.phone}`" class="text-muted hover:text-default hidden items-center gap-2 font-mono text-xs transition sm:flex">
            <UIcon name="i-lucide-phone" class="size-4" />{{ studio.phone }}
          </a>
          <NuxtLink to="/login" class="bg-primary text-inverted hidden items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition hover:opacity-90 sm:inline-flex">
            <UIcon name="i-lucide-scissors" class="size-4" />Reservar
          </NuxtLink>
          <button type="button" aria-label="Menú" class="border-default bg-elevated flex size-9 items-center justify-center rounded-xl border lg:hidden" @click="menuOpen = true">
            <UIcon name="i-lucide-menu" class="size-5" />
          </button>
        </div>
      </div>
    </header>

    <!-- MENÚ MÓVIL -->
    <Transition enter-active-class="transition-opacity" leave-active-class="transition-opacity" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="menuOpen" class="fixed inset-0 z-50 lg:hidden" @click="menuOpen = false">
        <div class="absolute inset-0 bg-black/70 backdrop-blur-sm" />
        <nav class="border-default bg-muted absolute top-0 right-0 flex h-full w-72 max-w-[82vw] flex-col gap-1 border-l p-4" @click.stop>
          <div class="mb-4 flex items-center justify-between">
            <div class="flex items-center gap-2">
              <AppLogo variant="mark" :size="22" />
              <span class="font-display text-base leading-none">{{ studio.name }}</span>
            </div>
            <button type="button" aria-label="Cerrar" class="text-muted flex size-8 items-center justify-center" @click="menuOpen = false"><UIcon name="i-lucide-x" class="size-5" /></button>
          </div>
          <a v-for="n in NAV" :key="n.to" :href="n.to" class="text-default rounded-xl px-3 py-3 text-base font-medium" @click="menuOpen = false">{{ n.label }}</a>
          <NuxtLink to="/login" class="bg-primary text-inverted mt-3 flex items-center justify-center gap-2 rounded-full px-4 py-3 text-sm font-semibold">
            <UIcon name="i-lucide-scissors" class="size-4" />Reservar cita
          </NuxtLink>
          <a v-if="studio.phone" :href="`tel:${studio.phone}`" class="text-muted mt-4 flex items-center justify-center gap-2 font-mono text-xs"><UIcon name="i-lucide-phone" class="size-4" />{{ studio.phone }}</a>
        </nav>
      </div>
    </Transition>

    <!-- HERO -->
    <section id="top" class="relative overflow-hidden">
      <UiParticles class="absolute inset-0 z-0" :count="48" />
      <div class="relative z-10 mx-auto grid w-full max-w-6xl items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-14 lg:py-20">
        <div>
          <h1 class="font-display text-5xl leading-[0.98] sm:text-6xl lg:text-7xl">
            Tu mejor versión empieza en la <em class="text-primary italic">silla</em>.
          </h1>
          <p class="text-muted mt-5 max-w-md text-base leading-relaxed">
            Cortes de precisión, barba a navaja y un buen rato. Reserva online con tu barbero de siempre, sin llamadas ni esperas.
          </p>
          <div class="mt-7 flex flex-wrap gap-3">
            <NuxtLink to="/login" class="bg-primary text-inverted inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition hover:opacity-90">
              <UIcon name="i-lucide-scissors" class="size-4" />Reservar cita
            </NuxtLink>
            <a href="#servicios" class="border-default bg-elevated/40 text-default inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm font-semibold backdrop-blur transition hover:bg-elevated">
              Ver la carta
            </a>
          </div>
          <div class="border-default mt-10 grid max-w-md grid-cols-3 gap-4 border-t pt-6">
            <div v-for="m in HERO_META" :key="m.l">
              <div class="font-display text-3xl leading-none">{{ m.n }}</div>
              <div class="text-dimmed mt-1.5 text-[0.7rem] leading-tight">{{ m.l }}</div>
            </div>
          </div>
        </div>

        <!-- visual: vídeo hero -->
        <div class="relative">
          <div class="border-default relative aspect-[4/5] overflow-hidden rounded-3xl border">
            <video class="absolute inset-0 size-full object-cover" :src="heroVideo" autoplay muted loop playsinline preload="auto" aria-hidden="true" />
            <div class="absolute inset-0" style="background: linear-gradient(180deg, transparent 40%, color-mix(in oklab, var(--jdvm-bg-0) 70%, transparent) 100%)" />
            <div v-if="openNow" class="border-default bg-default/80 absolute bottom-4 left-4 flex items-center gap-2.5 rounded-2xl border px-3.5 py-2.5 backdrop-blur">
              <span class="size-2.5 rounded-full" :class="openNow.open ? 'bg-success animate-pulse' : 'bg-error'" />
              <div>
                <div class="text-sm font-semibold">{{ openNow.open ? 'Abierto ahora' : 'Cerrado ahora' }}</div>
                <div v-if="openNow.open && openNow.closesAt" class="text-dimmed text-xs">Cierra a las {{ openNow.closesAt }}</div>
                <div v-else class="text-dimmed text-xs">Reserva online 24/7</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- SERVICIOS -->
    <section id="servicios" class="mx-auto w-full max-w-6xl scroll-mt-20 px-5 py-20 sm:px-8 lg:py-28">
      <div class="max-w-2xl">
        <span class="text-primary font-mono text-[0.7rem] tracking-[0.25em] uppercase">La carta</span>
        <h2 class="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">Un servicio para cada ocasión.</h2>
        <p class="text-muted mt-4 text-base leading-relaxed">Precios claros, sin sorpresas. Cada cita incluye lavado, toalla caliente y el tiempo que tu pelo merece.</p>
      </div>
      <div class="mt-12 grid gap-x-12 gap-y-10 sm:grid-cols-2">
        <div v-for="g in CARTA" :key="g.cat">
          <div class="mb-4 flex items-center gap-3">
            <span class="font-mono text-xs tracking-widest uppercase">{{ g.cat }}</span>
            <span class="bg-border h-px flex-1" />
          </div>
          <div v-for="it in g.items" :key="it.id" class="border-default flex items-center justify-between gap-4 border-b py-4">
            <div class="min-w-0">
              <span class="font-medium">{{ it.name }}</span>
              <div class="text-dimmed mt-0.5 text-sm">{{ it.description }}</div>
              <div class="text-dimmed mt-1 font-mono text-[0.65rem]">{{ formatDuration(it.durationMinutes) }}</div>
            </div>
            <div class="font-display shrink-0 text-2xl">{{ it.basePrice }}<small class="text-muted ml-0.5 text-sm">€</small></div>
          </div>
        </div>
      </div>
      <UiEmptyState v-if="!CARTA.length" class="mt-10" title="Carta en preparación" description="Pronto verás aquí todos los servicios." />
    </section>

    <!-- ESTUDIO -->
    <section id="estudio" class="mx-auto w-full max-w-6xl scroll-mt-20 px-5 pb-20 sm:px-8 lg:pb-28">
      <div class="max-w-2xl">
        <span class="text-primary font-mono text-[0.7rem] tracking-[0.25em] uppercase">El estudio</span>
        <h2 class="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">Nuestro trabajo habla por sí solo.</h2>
        <p class="text-muted mt-4 text-base leading-relaxed">Una selección de cortes recientes. Síguenos en Instagram para ver lo último que sale de la silla.</p>
      </div>
      <div class="mt-10 grid auto-rows-[120px] grid-cols-2 gap-3 sm:auto-rows-[150px] lg:grid-cols-4 lg:auto-rows-[170px]">
        <UiPhoto v-for="(p, i) in GALLERY" :key="i" :src="p.src" :label="p.label" :radius="16" class="size-full" :class="p.cls" />
      </div>
      <div v-if="igUrl" class="mt-8">
        <a :href="igUrl" target="_blank" rel="noopener" class="border-default bg-elevated/40 text-default hover:bg-elevated inline-flex items-center gap-2 rounded-full border px-6 py-3 text-sm font-semibold transition">
          <UIcon name="i-lucide-instagram" class="size-4" />Síguenos en Instagram
        </a>
      </div>
    </section>

    <!-- EQUIPO -->
    <section id="equipo" class="mx-auto w-full max-w-6xl scroll-mt-20 px-5 pb-20 sm:px-8 lg:pb-28">
      <div class="max-w-2xl">
        <span class="text-primary font-mono text-[0.7rem] tracking-[0.25em] uppercase">El equipo</span>
        <h2 class="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">Manos que saben lo que hacen.</h2>
        <p class="text-muted mt-4 text-base leading-relaxed">Siete barberos, un mismo estándar. Elige con quién quieres sentarte o déjate sorprender.</p>
      </div>
      <div class="mt-10 grid gap-5 sm:grid-cols-3">
        <NuxtLink v-for="m in TEAM" :key="m.id" to="/login" class="border-default bg-muted hover:border-primary/40 block overflow-hidden rounded-2xl border transition">
          <UiPhoto :src="m.photoUrl" :label="`${m.name.split(' ')[0]?.toLowerCase()} · retrato`" :radius="0" ratio="4 / 3" class="!border-x-0 !border-t-0" />
          <div class="p-5">
            <h3 class="font-display text-2xl leading-none">{{ m.name }}</h3>
            <div class="text-primary mt-1.5 font-mono text-[0.65rem] tracking-wide uppercase">{{ m.role }}</div>
            <p class="text-muted mt-3 text-sm leading-relaxed">{{ m.bio }}</p>
            <div v-if="m.tags.length" class="mt-4 flex flex-wrap gap-1.5">
              <span v-for="t in m.tags" :key="t" class="bg-elevated text-dimmed rounded-full px-2.5 py-1 font-mono text-[0.6rem]">{{ t }}</span>
            </div>
          </div>
        </NuxtLink>
      </div>
      <UiEmptyState v-if="!TEAM.length" class="mt-10" title="Equipo en formación" description="Pronto presentaremos a nuestros barberos." />
    </section>

    <!-- TESTIMONIOS -->
    <section v-if="TESTIMONIALS.length" class="mx-auto w-full max-w-6xl px-5 pb-20 sm:px-8 lg:pb-28">
      <div class="max-w-2xl">
        <span class="text-primary font-mono text-[0.7rem] tracking-[0.25em] uppercase">Lo que dicen</span>
        <h2 class="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">Clientes que vuelven cada mes.</h2>
      </div>
      <div class="mt-10 grid gap-5 lg:grid-cols-3">
        <div v-for="(t, i) in TESTIMONIALS" :key="i" class="border-default bg-muted rounded-2xl border p-6">
          <UiStarRating :model-value="t.score" readonly :size="15" />
          <p class="font-display mt-4 text-lg leading-snug">“{{ t.q }}”</p>
          <div class="mt-5 flex items-center gap-3">
            <div class="bg-elevated border-default flex size-10 items-center justify-center rounded-full border text-xs font-semibold">{{ t.av }}</div>
            <div>
              <div class="text-sm font-semibold">{{ t.nm }}</div>
              <div class="text-dimmed text-xs">{{ t.mt }}</div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- VISÍTANOS -->
    <section id="visitanos" class="mx-auto w-full max-w-6xl scroll-mt-20 px-5 pb-20 sm:px-8 lg:pb-28">
      <div class="max-w-2xl">
        <span class="text-primary font-mono text-[0.7rem] tracking-[0.25em] uppercase">Visítanos</span>
        <h2 class="font-display mt-3 text-4xl leading-[1.05] sm:text-5xl">{{ cityShort ? `Estamos en ${cityShort}.` : 'Dónde encontrarnos.' }}</h2>
      </div>
      <div class="mt-10 grid gap-6 lg:grid-cols-2">
        <div>
          <div class="border-default bg-muted overflow-hidden rounded-2xl border">
            <div v-for="(r, i) in HOURS" :key="r.d" class="flex items-center justify-between px-5 py-3.5 text-sm" :class="[i ? 'border-default border-t' : '', r.today ? 'bg-primary/10' : '']">
              <span :class="r.today ? 'text-primary font-semibold' : 'text-muted'">{{ r.d }}</span>
              <span class="font-mono" :class="r.h === 'Cerrado' ? 'text-dimmed' : 'text-default'">{{ r.h }}</span>
            </div>
          </div>
          <div class="mt-5 space-y-4">
            <div class="flex items-start gap-3">
              <UIcon name="i-lucide-map-pin" class="text-primary mt-0.5 size-5 shrink-0" />
              <div><div class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Dirección</div><div class="text-sm">{{ studio.address }}</div></div>
            </div>
            <div v-if="studio.phone" class="flex items-start gap-3">
              <UIcon name="i-lucide-phone" class="text-primary mt-0.5 size-5 shrink-0" />
              <div><div class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Teléfono</div><a :href="`tel:${studio.phone}`" class="text-sm">{{ studio.phone }}</a></div>
            </div>
            <NuxtLink to="/login" class="bg-primary text-inverted inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition hover:opacity-90">
              <UIcon name="i-lucide-scissors" class="size-4" />Reservar mi cita
            </NuxtLink>
          </div>
        </div>
        <component
          :is="studio.mapsUrl ? 'a' : 'div'"
          :href="studio.mapsUrl || undefined"
          :target="studio.mapsUrl ? '_blank' : undefined"
          rel="noopener"
          class="border-default relative block min-h-72 overflow-hidden rounded-2xl border"
        >
          <UiPhoto label="mapa · maracena" :radius="0" class="absolute inset-0 size-full !border-0" />
          <div class="absolute inset-0 flex items-center justify-center">
            <span class="text-primary flex size-12 items-center justify-center"><UIcon name="i-lucide-map-pin" class="size-9 drop-shadow-lg" /></span>
          </div>
        </component>
      </div>
    </section>

    <!-- CTA BAND -->
    <section id="reservar" class="border-default scroll-mt-20 border-y" style="background: linear-gradient(180deg, var(--jdvm-bg-1), var(--jdvm-bg-0))">
      <div class="mx-auto w-full max-w-3xl px-5 py-20 text-center sm:px-8 lg:py-24">
        <span class="text-primary font-mono text-[0.7rem] tracking-[0.25em] uppercase">Tu sitio te espera</span>
        <h2 class="font-display mt-4 text-4xl leading-[1.05] sm:text-5xl">Reserva en menos de un minuto.</h2>
        <p class="text-muted mx-auto mt-4 max-w-md text-base leading-relaxed">Elige servicio, barbero y hora desde la app. Te recordamos la cita y cancelas gratis cuando quieras.</p>
        <div class="mt-8 flex flex-wrap justify-center gap-3">
          <NuxtLink to="/login" class="bg-primary text-inverted inline-flex items-center gap-2 rounded-full px-6 py-3.5 text-sm font-semibold transition hover:opacity-90">
            <UIcon name="i-lucide-smartphone" class="size-4" />Abrir la app
          </NuxtLink>
          <NuxtLink to="/registro" class="border-default bg-elevated/40 text-default inline-flex items-center gap-2 rounded-full border px-6 py-3.5 text-sm font-semibold backdrop-blur transition hover:bg-elevated">
            Crear cuenta
          </NuxtLink>
        </div>
      </div>
    </section>

    <!-- FOOTER -->
    <footer class="mx-auto w-full max-w-6xl px-5 py-14 sm:px-8">
      <div class="grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <div class="flex items-center gap-2.5">
            <AppLogo variant="mark" :size="28" />
            <span class="font-display text-xl leading-none">{{ studio.name }}</span>
          </div>
          <p class="text-muted mt-4 max-w-xs text-sm leading-relaxed">Barbería de barrio{{ cityShort ? ` en ${cityShort}` : '' }} desde {{ studio.foundedYear }}. Cortes de precisión, barba a navaja y buen ambiente.</p>
          <div class="mt-5 flex gap-2.5">
            <a v-if="igUrl" :href="igUrl" target="_blank" rel="noopener" aria-label="Instagram" class="border-default bg-muted text-muted hover:text-default hover:border-primary/40 flex size-9 items-center justify-center rounded-xl border transition">
              <UIcon name="i-lucide-instagram" class="size-4" />
            </a>
            <a v-if="fbUrl" :href="fbUrl" target="_blank" rel="noopener" aria-label="Facebook" class="border-default bg-muted text-muted hover:text-default hover:border-primary/40 flex size-9 items-center justify-center rounded-xl border transition">
              <UIcon name="i-lucide-facebook" class="size-4" />
            </a>
            <a v-if="tiktokUrl" :href="tiktokUrl" target="_blank" rel="noopener" aria-label="TikTok" class="border-default bg-muted text-muted hover:text-default hover:border-primary/40 flex size-9 items-center justify-center rounded-xl border transition">
              <UIcon name="i-lucide-music-2" class="size-4" />
            </a>
            <a v-if="studio.phone" :href="`tel:${studio.phone}`" aria-label="Teléfono" class="border-default bg-muted text-muted hover:text-default hover:border-primary/40 flex size-9 items-center justify-center rounded-xl border transition">
              <UIcon name="i-lucide-phone" class="size-4" />
            </a>
            <a v-if="studio.mapsUrl" :href="studio.mapsUrl" target="_blank" rel="noopener" aria-label="Cómo llegar" class="border-default bg-muted text-muted hover:text-default hover:border-primary/40 flex size-9 items-center justify-center rounded-xl border transition">
              <UIcon name="i-lucide-map-pin" class="size-4" />
            </a>
          </div>
        </div>
        <div>
          <h4 class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">Servicios</h4>
          <a v-for="x in ['Cortes', 'Barba', 'Premium', 'Extras']" :key="x" href="#servicios" class="text-muted hover:text-default block py-1.5 text-sm">{{ x }}</a>
        </div>
        <div>
          <h4 class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">Estudio</h4>
          <a href="#estudio" class="text-muted hover:text-default block py-1.5 text-sm">Galería</a>
          <a href="#equipo" class="text-muted hover:text-default block py-1.5 text-sm">Equipo</a>
          <a href="#visitanos" class="text-muted hover:text-default block py-1.5 text-sm">Horario</a>
          <a href="#visitanos" class="text-muted hover:text-default block py-1.5 text-sm">Cómo llegar</a>
        </div>
        <div>
          <h4 class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">Reservar</h4>
          <NuxtLink to="/login" class="text-muted hover:text-default block py-1.5 text-sm">Reserva web</NuxtLink>
          <NuxtLink to="/registro" class="text-muted hover:text-default block py-1.5 text-sm">Crear cuenta</NuxtLink>
          <NuxtLink to="/lista-espera" class="text-muted hover:text-default block py-1.5 text-sm">Lista de espera</NuxtLink>
        </div>
      </div>
      <div class="border-default text-dimmed mt-10 flex flex-col items-center justify-between gap-2 border-t pt-6 text-xs sm:flex-row">
        <span>© {{ currentYear }} {{ studio.name }}{{ cityLabel ? ` · ${cityLabel}` : '' }}</span>
        <span class="font-mono">Hecho con tijera y cariño</span>
      </div>
    </footer>
  </div>
</template>

<style>
html {
  scroll-behavior: smooth;
}
</style>
