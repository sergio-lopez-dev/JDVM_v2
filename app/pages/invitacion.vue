<script setup lang="ts">
import { authErrorMessage } from '~~/lib/authErrors'
import type { BarberInvite } from '~~/schemas'

definePageMeta({ layout: 'auth', middleware: 'guest' })
useHead({ title: 'Únete al equipo' })

const route = useRoute()
const toast = useToast()
const { registerWithPassword, signInWithGoogle, destinationFor } = useAuth()
const { getByEmail } = useBarberInvites()
const { name: studioName } = useStudio()

const email = ref(String(route.query.email ?? '').toLowerCase())
const password = ref('')
const loading = ref(false)
const invite = ref<BarberInvite | null>(null)
const checking = ref(true)

// Carga la invitación (si llega el email en la URL) para saludar por su nombre y
// validar que sigue pendiente.
onMounted(async () => {
  if (email.value) {
    try {
      invite.value = await getByEmail(email.value)
    } catch {
      /* sin permiso o sin red: seguimos, el reclamo se valida al entrar */
    }
  }
  checking.value = false
})

const barberName = computed(() => invite.value?.barber?.name ?? '')
const alreadyAccepted = computed(() => invite.value?.status === 'accepted')

// Tras autenticarse, ensureUserDoc ya reclamó la invitación → enruta por rol.
async function finish(uid: string) {
  const dest = await destinationFor(uid)
  if (dest === '/staff') {
    toast.add({ title: '¡Bienvenido al equipo!', icon: 'i-lucide-party-popper', color: 'success' })
    await navigateTo('/staff')
  } else {
    // No había invitación para ese email (o ya estaba aceptada): es un cliente normal.
    toast.add({
      title: 'Cuenta creada',
      description: 'Este email no tenía una invitación de barbero activa.',
      color: 'warning',
      icon: 'i-lucide-info',
    })
    await navigateTo('/app')
  }
}

async function withPassword() {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    toast.add({ title: 'Email no válido', color: 'error', icon: 'i-lucide-triangle-alert' })
    return
  }
  if (password.value.length < 6) {
    toast.add({ title: 'La contraseña debe tener al menos 6 caracteres', color: 'error', icon: 'i-lucide-triangle-alert' })
    return
  }
  loading.value = true
  try {
    const u = await registerWithPassword({ email: email.value, password: password.value, name: barberName.value })
    await finish(u.uid)
  } catch (e) {
    toast.add({ title: 'No se pudo crear el acceso', description: authErrorMessage(e), color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    loading.value = false
  }
}

async function withGoogle() {
  loading.value = true
  try {
    const u = await signInWithGoogle()
    await finish(u.uid)
  } catch (e) {
    toast.add({ title: 'Google', description: authErrorMessage(e), color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <div class="flex flex-col items-center gap-4 text-center">
      <AppLogo variant="mark" :size="44" />
      <p class="text-primary font-mono text-[0.6rem] tracking-[0.18em] uppercase">Invitación de equipo</p>
      <h1 class="font-display text-4xl leading-none">
        {{ barberName ? `Hola, ${barberName}` : 'Únete al equipo' }}
      </h1>
      <p class="text-muted text-sm">
        Te damos acceso como barbero de <strong class="text-default">{{ studioName }}</strong
        >. Crea tu acceso para entrar en tu app.
      </p>
    </div>

    <UAlert
      v-if="!checking && alreadyAccepted"
      color="warning"
      variant="soft"
      icon="i-lucide-info"
      title="Invitación ya aceptada"
      description="Esta invitación ya se usó. Inicia sesión normalmente desde Acceder."
    />

    <div class="flex flex-col gap-4">
      <UButton
        size="lg"
        color="neutral"
        variant="outline"
        block
        icon="i-lucide-chrome"
        :loading="loading"
        @click="withGoogle"
      >
        Continuar con Google
      </UButton>

      <div class="flex items-center gap-3">
        <span class="bg-border h-px flex-1" />
        <span class="text-dimmed text-xs">o con contraseña</span>
        <span class="bg-border h-px flex-1" />
      </div>

      <UFormField label="Email">
        <UInput v-model="email" type="email" autocomplete="email" placeholder="tu@email.com" class="w-full" />
      </UFormField>
      <UFormField label="Contraseña" hint="mín. 6">
        <UInput v-model="password" type="password" autocomplete="new-password" placeholder="••••••" class="w-full" />
      </UFormField>
      <UButton size="lg" color="primary" block :loading="loading" @click="withPassword">Crear mi acceso</UButton>
    </div>

    <p class="text-dimmed text-center text-xs">
      ¿Ya tienes cuenta? <NuxtLink to="/login" class="text-primary font-semibold">Acceder</NuxtLink>
    </p>
  </div>
</template>
