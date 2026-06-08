<script setup lang="ts">
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage'
import { fmtDate } from '~~/lib/format'
import { toDate } from '~~/lib/datetime'
import type { Barber, BarberInput, WeekTimetable, DateRange } from '~~/schemas'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Equipo · Admin' })

const { barbers, sendInvite, update, remove } = useBarbers()
const { pending: pendingInvites, create: createInvite, sendEmail: sendInviteEmail, remove: removeInvite } = useBarberInvites()
const { services } = useServices()
const { reviews } = useReviews()
const { clients } = useClients()
const { name: studioName } = useStudio()
const { settings } = useSettings()

// Enlace de invitación que comparte el admin (lleva a la pantalla /invitacion).
const inviteLink = (email: string) =>
  import.meta.client ? `${window.location.origin}/invitacion?email=${encodeURIComponent(email)}` : ''

const inviteText = (email: string) =>
  `Te invito a unirte al equipo de ${studioName.value} como barbero. Crea tu acceso (Google o contraseña) usando este email (${email}) aquí:`

// Menú de compartir nativo (WhatsApp, email, copiar…). En escritorio sin soporte,
// cae a copiar el enlace.
async function shareInvite(email: string) {
  const url = inviteLink(email)
  if (import.meta.client && navigator.share) {
    try {
      await navigator.share({ title: `Invitación · ${studioName.value}`, text: inviteText(email), url })
    } catch {
      /* el usuario cerró el diálogo de compartir */
    }
  } else {
    await copyInvite(email)
  }
}

async function copyInvite(email: string) {
  try {
    await navigator.clipboard.writeText(`${inviteText(email)} ${inviteLink(email)}`)
    toast.add({ title: 'Enlace copiado', description: email, icon: 'i-lucide-clipboard-check', color: 'success' })
  } catch {
    toast.add({ title: 'No se pudo copiar', color: 'error' })
  }
}

async function cancelInvite(email: string) {
  if (!confirm(`¿Cancelar la invitación de ${email}?`)) return
  await removeInvite(email)
  toast.add({ title: 'Invitación cancelada', icon: 'i-lucide-trash-2' })
}

// Email de acceso del barbero (vive en users_v2/{uid}, no en el doc del barbero).
// Solo existe si se creó con cuenta (id del barbero == uid). Sirve para reinvitar.
const emailOf = (id: string | null) =>
  (id && clients.value.find((c) => c.id === id)?.email) || ''

const inviting = ref(false)
async function resendInvite() {
  const email = emailOf(form.value.id)
  if (!email) return
  inviting.value = true
  try {
    await sendInvite(email)
    toast.add({ title: 'Invitación reenviada', description: email, icon: 'i-lucide-mail-check', color: 'success' })
  } catch (e) {
    toast.add({ title: 'No se pudo reenviar', description: (e as Error).message, color: 'error' })
  } finally {
    inviting.value = false
  }
}
const storage = useFirebaseStorage()
const toast = useToast()

// Subida de foto del barbero a Storage (carpeta barbers/).
const photoInput = ref<HTMLInputElement | null>(null)
const uploadingPhoto = ref(false)
async function onPhoto(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingPhoto.value = true
  try {
    const safe = file.name.replace(/[^\w.-]+/g, '_')
    const path = `${STORAGE_PREFIX}barbers/${form.value.slug || Date.now()}-${safe}`
    const r = storageRef(storage, path)
    await uploadBytes(r, file)
    form.value.photoUrl = await getDownloadURL(r)
  } catch (err) {
    toast.add({ title: 'No se pudo subir la foto', description: (err as Error).message, color: 'error' })
  } finally {
    uploadingPhoto.value = false
    if (photoInput.value) photoInput.value.value = ''
  }
}

// Stats por barbero (valoración media + nº de reseñas) sobre el estado reactivo.
function statsOf(id: string) {
  const list = reviews.value.filter((r) => r.barberId === id)
  const avg = list.length ? list.reduce((s, r) => s + r.score, 0) / list.length : 0
  return { rating: avg ? avg.toFixed(1) : '—', count: list.length }
}

// Chips de horario: día de la semana → abierto/cerrado según timetable.
const DAY_LETTERS: [string, string][] = [
  ['mon', 'L'],
  ['tue', 'M'],
  ['wed', 'X'],
  ['thu', 'J'],
  ['fri', 'V'],
  ['sat', 'S'],
  ['sun', 'D'],
]
function isOpenDay(b: Barber, key: string) {
  const dt = (b.timetable as Record<string, unknown>)?.[key] as
    | { morning?: unknown; afternoon?: unknown }
    | undefined
  return !!(dt && (dt.morning || dt.afternoon))
}

interface FormState {
  id: string | null
  name: string
  email: string
  slug: string
  color: string
  instagram: string
  bio: string
  photoUrl: string
  active: boolean
  commissionPercent: number
  servicesOffered: string[]
  timetable: WeekTimetable
  vacations: DateRange[]
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

function blank(): FormState {
  return {
    id: null,
    name: '',
    email: '',
    slug: '',
    color: '#C2A24E',
    instagram: '',
    bio: '',
    photoUrl: '',
    active: true,
    commissionPercent: 50,
    servicesOffered: services.value.map((s) => s.id),
    // Por defecto hereda el horario del local; el admin lo ajusta si hace falta.
    timetable: structuredClone(toRaw(settings.value?.timetable ?? {})) as WeekTimetable,
    vacations: [],
  }
}

const open = ref(false)
const form = ref<FormState>(blank())
const saving = ref(false)

function startCreate() {
  form.value = blank()
  open.value = true
}
function startEdit(b: Barber) {
  form.value = {
    id: b.id,
    name: b.name,
    email: '',
    slug: b.slug,
    color: b.color,
    instagram: b.instagram ?? '',
    bio: b.bio ?? '',
    photoUrl: b.photoUrl ?? '',
    active: b.active,
    commissionPercent: b.commissionPercent ?? 50,
    servicesOffered: [...(b.servicesOffered ?? [])],
    timetable: structuredClone(toRaw(b.timetable ?? {})),
    vacations: (b.vacations ?? []).map((v) => ({ start: toDate(v.start), end: toDate(v.end) })),
  }
  open.value = true
}

// Autogenera slug mientras se escribe el nombre (solo en alta).
watch(
  () => form.value.name,
  (n) => {
    if (!form.value.id && n) form.value.slug = slugify(n)
  },
)

function toggleService(id: string) {
  const list = form.value.servicesOffered
  const i = list.indexOf(id)
  if (i >= 0) list.splice(i, 1)
  else list.push(id)
}

function addVacation() {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 7)
  form.value.vacations.push({ start, end })
}
function setVacation(i: number, edge: 'start' | 'end', value: string) {
  const [y, m, d] = value.split('-').map(Number)
  if (y && m && d) form.value.vacations[i]![edge] = new Date(y, m - 1, d)
}
function removeVacation(i: number) {
  form.value.vacations.splice(i, 1)
}

async function save() {
  if (!form.value.name.trim()) {
    toast.add({ title: 'El nombre es obligatorio', color: 'error', icon: 'i-lucide-triangle-alert' })
    return
  }
  // En alta se crea la cuenta de acceso del barbero y se le invita por email.
  if (!form.value.id && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email.trim())) {
    toast.add({ title: 'Email no válido', color: 'error', icon: 'i-lucide-triangle-alert' })
    return
  }
  saving.value = true
  try {
    const payload: BarberInput = {
      name: form.value.name.trim(),
      slug: form.value.slug || slugify(form.value.name),
      color: form.value.color,
      // Firestore no admite `undefined`: guardamos '' cuando no hay instagram.
      instagram: form.value.instagram.trim(),
      bio: form.value.bio,
      photoUrl: form.value.photoUrl,
      active: form.value.active,
      commissionPercent: Math.min(100, Math.max(0, Math.round(form.value.commissionPercent))),
      servicesOffered: form.value.servicesOffered,
      timetable: form.value.timetable,
      vacations: form.value.vacations,
    }
    if (form.value.id) {
      await update(form.value.id, payload)
      toast.add({ title: 'Barbero actualizado', icon: 'i-lucide-check', color: 'success' })
    } else {
      // Alta por invitación: el barbero se da de alta él mismo (Google o contraseña)
      // con este email y se convierte en barbero al entrar. Sin crear cuenta aquí.
      const inviteEmail = form.value.email.trim()
      await createInvite(inviteEmail, payload)
      toast.add({
        title: 'Invitación creada',
        description: 'Copia el enlace (abajo) y pásaselo al barbero.',
        icon: 'i-lucide-link',
        color: 'success',
      })
      // Email de marca opcional (si hay Cloud Function + Resend configurados). Si no,
      // da igual: la invitación funciona por enlace. Intento silencioso en 2º plano.
      sendInviteEmail(inviteEmail)
        .then(() => toast.add({ title: 'Además, email enviado', icon: 'i-lucide-mail-check', color: 'success' }))
        .catch(() => {})
    }
    open.value = false
  } catch (e) {
    toast.add({ title: 'No se pudo guardar', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}

async function toggleActive(b: Barber) {
  await update(b.id, { active: !b.active })
}
async function confirmRemove() {
  if (!form.value.id) return
  if (!confirm(`¿Eliminar a ${form.value.name}? Esta acción no se puede deshacer.`)) return
  await remove(form.value.id)
  toast.add({ title: 'Barbero eliminado', icon: 'i-lucide-trash-2' })
  open.value = false
}
</script>

<template>
  <div>
    <AdminHeader title="Equipo" :sub="`${barbers.length} barberos · gestiona horarios, servicios y permisos`">
      <template #actions>
        <UButton color="primary" icon="i-lucide-plus" @click="startCreate">Añadir barbero</UButton>
      </template>
    </AdminHeader>

    <div class="px-5 py-6 pb-24 lg:px-7 lg:pb-6">
      <div class="grid gap-4 lg:grid-cols-2">
        <AdminCard v-for="b in barbers" :key="b.id" :pad="false" class="overflow-hidden" :class="!b.active ? 'opacity-70' : ''">
          <!-- cabecera -->
          <div class="flex gap-4 p-5">
            <div class="relative shrink-0">
              <UiAvatar :name="b.name" :src="b.photoUrl || null" :size="64" :ring="b.color" />
              <span class="absolute right-0.5 bottom-0.5 size-3.5 rounded-full border-2" :class="b.active ? 'bg-success' : 'bg-transparent'" :style="{ borderColor: 'var(--jdvm-bg-1)', background: b.active ? '' : 'var(--jdvm-fg-2)' }" />
            </div>
            <div class="min-w-0 flex-1">
              <div class="flex items-start justify-between gap-2">
                <div class="min-w-0">
                  <div class="font-display truncate text-2xl leading-none">{{ b.name }}</div>
                  <div class="text-primary mt-1.5 font-mono text-[0.65rem] tracking-wide">@{{ b.slug }}</div>
                </div>
                <button type="button" aria-label="Editar" class="text-dimmed hover:text-default shrink-0" @click="startEdit(b)"><UIcon name="i-lucide-pencil" class="size-[18px]" /></button>
              </div>
              <p v-if="b.bio" class="text-muted mt-2 line-clamp-2 text-xs">{{ b.bio }}</p>
            </div>
          </div>

          <!-- stats -->
          <div class="border-default flex border-y">
            <div class="flex-1 py-3.5 text-center">
              <div class="font-display text-xl">{{ statsOf(b.id).rating }}</div>
              <div class="text-dimmed mt-0.5 text-[0.65rem]">★ Valoración</div>
            </div>
            <div class="border-default flex-1 border-l py-3.5 text-center">
              <div class="font-display text-xl">{{ statsOf(b.id).count }}</div>
              <div class="text-dimmed mt-0.5 text-[0.65rem]">Reseñas</div>
            </div>
            <div class="border-default flex-1 border-l py-3.5 text-center">
              <div class="font-display text-xl">{{ b.servicesOffered?.length ?? 0 }}</div>
              <div class="text-dimmed mt-0.5 text-[0.65rem]">Servicios</div>
            </div>
          </div>

          <!-- horario + acciones -->
          <div class="flex items-center justify-between gap-2 px-5 py-3.5">
            <div class="flex gap-1.5">
              <span
                v-for="[key, letter] in DAY_LETTERS"
                :key="key"
                class="flex size-[1.6rem] items-center justify-center rounded-[7px] border text-[0.7rem] font-semibold"
                :class="isOpenDay(b, key) ? 'border-primary/30 bg-primary/15 text-primary' : 'border-default text-dimmed'"
              >{{ letter }}</span>
            </div>
            <UButton size="xs" variant="soft" :color="b.active ? 'warning' : 'success'" :icon="b.active ? 'i-lucide-pause' : 'i-lucide-play'" @click="toggleActive(b)">{{ b.active ? 'Pausar' : 'Activar' }}</UButton>
          </div>
        </AdminCard>

        <!-- alta -->
        <button type="button" class="border-default hover:border-primary/40 flex items-center gap-4 rounded-2xl border border-dashed p-5 text-left" @click="startCreate">
          <span class="bg-primary/15 flex size-12 items-center justify-center rounded-xl"><UIcon name="i-lucide-users" class="text-primary size-5" /></span>
          <div class="flex-1">
            <div class="text-sm font-semibold">¿Amplías plantilla?</div>
            <div class="text-dimmed mt-0.5 text-xs">Añade un barbero, define su horario y servicios. Aparecerá al instante en la app.</div>
          </div>
          <UIcon name="i-lucide-plus" class="text-primary size-5" />
        </button>
      </div>

      <!-- invitaciones pendientes (aún no han entrado en la app) -->
      <section v-if="pendingInvites.length" class="mt-8">
        <h2 class="font-display mb-3 flex items-center gap-2 text-lg">
          <UIcon name="i-lucide-mail-plus" class="text-primary size-5" />Invitaciones pendientes
        </h2>
        <div class="grid gap-3 lg:grid-cols-2">
          <div
            v-for="inv in pendingInvites"
            :key="inv.id"
            class="border-default bg-muted/50 flex items-center gap-3 rounded-2xl border border-dashed p-4"
          >
            <UiAvatar :name="inv.barber.name" :size="44" :ring="inv.barber.color" />
            <div class="min-w-0 flex-1">
              <div class="truncate text-sm font-semibold">{{ inv.barber.name }}</div>
              <div class="text-dimmed truncate text-xs">{{ inv.email }} · pendiente de aceptar</div>
            </div>
            <UButton size="sm" color="primary" variant="soft" icon="i-lucide-share-2" @click="shareInvite(inv.email)">Compartir</UButton>
            <UButton size="sm" color="neutral" variant="soft" icon="i-lucide-link" aria-label="Copiar enlace" @click="copyInvite(inv.email)" />
            <UButton size="sm" color="error" variant="ghost" icon="i-lucide-x" aria-label="Cancelar" @click="cancelInvite(inv.email)" />
          </div>
        </div>
        <p class="text-dimmed mt-3 text-xs">
          Comparte el enlace con el barbero. Al entrar con Google o contraseña usando ese email, se unirá al equipo automáticamente.
        </p>
      </section>
    </div>

    <!-- editor (drawer) -->
    <Transition enter-active-class="transition-opacity" leave-active-class="transition-opacity" enter-from-class="opacity-0" leave-to-class="opacity-0">
      <div v-if="open" class="fixed inset-0 z-50 flex justify-end" @click="open = false">
        <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
        <aside class="border-default bg-default relative flex h-full w-full max-w-lg flex-col overflow-hidden border-l" @click.stop>
          <header class="border-default flex items-center justify-between border-b px-5 py-4">
            <span class="font-display text-lg">{{ form.id ? 'Editar barbero' : 'Nuevo barbero' }}</span>
            <button type="button" aria-label="Cerrar" class="text-muted flex size-8 items-center justify-center" @click="open = false"><UIcon name="i-lucide-x" class="size-5" /></button>
          </header>

          <div class="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Nombre"><UInput v-model="form.name" placeholder="Dani Ruiz" class="w-full" /></UFormField>
              <UFormField label="Slug"><UInput v-model="form.slug" placeholder="dani-ruiz" class="w-full" /></UFormField>
            </div>

            <!-- Invitación: solo en alta. No se crea cuenta aquí; el barbero se da de
                 alta él mismo (Google o contraseña) con este email y se convierte en
                 barbero al entrar. Ver pantalla /invitacion + reclamo en useAuth. -->
            <div v-if="!form.id" class="border-default bg-muted/50 space-y-2 rounded-xl border p-3">
              <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Invitación</p>
              <UFormField label="Email del barbero">
                <UInput v-model="form.email" type="email" autocomplete="off" placeholder="dani@jdvm.es" class="w-full" />
              </UFormField>
              <p class="text-dimmed text-xs">Se creará una invitación. El barbero entra con <strong class="text-default">Google o contraseña</strong> usando este email y aterriza en su app (<span class="font-mono">/staff</span>).</p>
            </div>

            <!-- En edición: reenviar la invitación si el barbero tiene cuenta. -->
            <div v-else-if="emailOf(form.id)" class="border-default bg-muted/50 flex items-center justify-between gap-3 rounded-xl border p-3">
              <div class="min-w-0">
                <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Cuenta de acceso</p>
                <p class="mt-1 truncate text-sm">{{ emailOf(form.id) }}</p>
              </div>
              <UButton color="neutral" variant="soft" size="sm" icon="i-lucide-mail" :loading="inviting" @click="resendInvite">Reenviar invitación</UButton>
            </div>
            <div class="grid grid-cols-[auto_1fr] items-end gap-3">
              <UFormField label="Color">
                <input v-model="form.color" type="color" class="border-default bg-muted h-10 w-14 cursor-pointer rounded-lg border" />
              </UFormField>
              <UFormField label="Instagram"><UInput v-model="form.instagram" placeholder="usuario" class="w-full" /></UFormField>
            </div>
            <UFormField label="Bio"><UTextarea v-model="form.bio" :rows="2" placeholder="Especialista en…" class="w-full" /></UFormField>

            <UFormField label="Foto de perfil">
              <div class="flex items-center gap-3">
                <UiAvatar :name="form.name" :src="form.photoUrl || null" :size="56" :ring="form.color" />
                <input ref="photoInput" type="file" accept="image/*" class="hidden" @change="onPhoto" />
                <UButton color="neutral" variant="soft" icon="i-lucide-upload" :loading="uploadingPhoto" @click="photoInput?.click()">Subir foto</UButton>
                <UButton v-if="form.photoUrl" color="neutral" variant="ghost" icon="i-lucide-x" aria-label="Quitar" @click="form.photoUrl = ''" />
              </div>
            </UFormField>

            <div class="border-default bg-muted flex items-center justify-between rounded-xl border p-3">
              <div><p class="text-sm font-semibold">Activo</p><p class="text-dimmed text-xs">Aparece en reserva y estudio</p></div>
              <USwitch v-model="form.active" />
            </div>

            <UFormField label="Comisión del barbero (%)" hint="Solo la ve él y el admin">
              <div class="flex items-center gap-3">
                <UInput v-model.number="form.commissionPercent" type="number" min="0" max="100" class="w-28" />
                <span class="text-dimmed text-xs">del importe de sus servicios. El resto es del local.</span>
              </div>
            </UFormField>

            <div>
              <p class="text-dimmed mb-2 font-mono text-[0.6rem] tracking-widest uppercase">Servicios que ofrece</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="s in services"
                  :key="s.id"
                  type="button"
                  class="rounded-full border px-3 py-1.5 text-sm"
                  :class="form.servicesOffered.includes(s.id) ? 'border-primary/40 bg-primary/10 text-primary' : 'border-default bg-muted text-muted'"
                  @click="toggleService(s.id)"
                >{{ s.name }}</button>
              </div>
            </div>

            <div>
              <p class="text-dimmed mb-2 font-mono text-[0.6rem] tracking-widest uppercase">Horario semanal</p>
              <WeekTimetableEditor v-model="form.timetable" />
            </div>

            <div>
              <div class="mb-2 flex items-center justify-between">
                <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Vacaciones</p>
                <button type="button" class="text-primary text-xs font-semibold" @click="addVacation">+ Añadir</button>
              </div>
              <div v-if="form.vacations.length" class="space-y-2">
                <div v-for="(v, i) in form.vacations" :key="i" class="border-default bg-muted flex items-center gap-2 rounded-xl border p-2.5">
                  <input type="date" :value="fmtDate(v.start, 'yyyy-MM-dd')" class="border-default bg-elevated text-default flex-1 rounded-lg border px-2 py-1 text-xs [color-scheme:dark]" @input="setVacation(i, 'start', ($event.target as HTMLInputElement).value)" />
                  <span class="text-dimmed text-xs">→</span>
                  <input type="date" :value="fmtDate(v.end, 'yyyy-MM-dd')" class="border-default bg-elevated text-default flex-1 rounded-lg border px-2 py-1 text-xs [color-scheme:dark]" @input="setVacation(i, 'end', ($event.target as HTMLInputElement).value)" />
                  <button type="button" class="text-error flex size-7 items-center justify-center" @click="removeVacation(i)"><UIcon name="i-lucide-trash-2" class="size-4" /></button>
                </div>
              </div>
              <p v-else class="text-dimmed text-xs">Sin vacaciones programadas.</p>
            </div>
          </div>

          <footer class="border-default flex items-center gap-2.5 border-t px-5 py-4">
            <UButton v-if="form.id" color="error" variant="ghost" icon="i-lucide-trash-2" @click="confirmRemove" />
            <div class="flex-1" />
            <UButton color="neutral" variant="ghost" @click="open = false">Cancelar</UButton>
            <UButton color="primary" :loading="saving" icon="i-lucide-check" @click="save">Guardar</UButton>
          </footer>
        </aside>
      </div>
    </Transition>
  </div>
</template>
