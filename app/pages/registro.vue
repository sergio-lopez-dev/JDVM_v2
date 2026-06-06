<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { signUpSchema, type SignUpInput } from '~~/schemas'
import { authErrorMessage } from '~~/lib/authErrors'
import { normalizePhone } from '~~/lib/phone'

definePageMeta({ layout: 'auth', middleware: 'guest' })
useHead({ title: 'Crear cuenta' })

const toast = useToast()
const { signUp, signInWithGoogle } = useAuth()
const { name: studioName } = useStudio()

const state = reactive<SignUpInput>({ name: '', email: '', phone: '', password: '' })
const loading = ref(false)

// Mantener el teléfono solo con dígitos (máx. 9).
watch(
  () => state.phone,
  (v) => {
    const clean = normalizePhone(v)
    if (clean !== v) state.phone = clean
  },
)

async function onSubmit(event: FormSubmitEvent<SignUpInput>) {
  loading.value = true
  try {
    await signUp(event.data)
    await navigateTo('/app')
  } catch (e) {
    toast.add({ title: 'No se pudo crear la cuenta', description: authErrorMessage(e), color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    loading.value = false
  }
}

async function google() {
  loading.value = true
  try {
    await signInWithGoogle()
    await navigateTo('/completar-perfil')
  } catch (e) {
    toast.add({ title: 'Google', description: authErrorMessage(e), color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex flex-col gap-8">
    <div class="flex flex-col items-center gap-5 text-center">
      <AppLogo variant="mark" :size="44" />
      <p class="font-display text-xl leading-none">{{ studioName }}</p>
      <h1 class="font-display text-4xl leading-none">Crea tu cuenta</h1>
      <p class="text-muted text-sm">Reserva con tu barbero de siempre, sin llamadas.</p>
    </div>

    <UForm :schema="signUpSchema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
      <UFormField label="Nombre" name="name">
        <UInput v-model="state.name" placeholder="Tu nombre" icon="i-lucide-user" size="lg" class="w-full" />
      </UFormField>

      <UFormField label="Email" name="email">
        <UInput
          v-model="state.email"
          type="email"
          placeholder="tu@email.com"
          icon="i-lucide-mail"
          size="lg"
          autocomplete="email"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Teléfono" name="phone" help="9 dígitos, sin prefijo.">
        <UInput
          v-model="state.phone"
          type="tel"
          inputmode="numeric"
          placeholder="600 000 000"
          icon="i-lucide-phone"
          size="lg"
          class="w-full"
        />
      </UFormField>

      <UFormField label="Contraseña" name="password" help="Mínimo 6 caracteres.">
        <UInput
          v-model="state.password"
          type="password"
          placeholder="••••••••"
          icon="i-lucide-lock"
          size="lg"
          autocomplete="new-password"
          class="w-full"
        />
      </UFormField>

      <UButton type="submit" color="primary" size="lg" block :loading="loading"> Crear cuenta </UButton>
    </UForm>

    <div class="flex items-center gap-3">
      <span class="bg-border h-px flex-1" />
      <span class="text-dimmed font-mono text-[0.7rem] tracking-widest uppercase">o</span>
      <span class="bg-border h-px flex-1" />
    </div>

    <UButton color="neutral" variant="outline" size="lg" block :disabled="loading" @click="google">
      <IconGoogle :size="18" />
      Continuar con Google
    </UButton>

    <p class="text-muted text-center text-sm">
      ¿Ya tienes cuenta?
      <NuxtLink to="/login" class="text-primary font-medium">Entra</NuxtLink>
    </p>
  </div>
</template>
