<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { signInSchema, type SignInInput } from '~~/schemas'
import { authErrorMessage } from '~~/lib/authErrors'

definePageMeta({ layout: 'auth', middleware: 'guest' })
useHead({ title: 'Entrar · JDVM' })

const route = useRoute()
const toast = useToast()
const { signIn, signInWithGoogle } = useAuth()

const state = reactive<SignInInput>({ email: '', password: '' })
const loading = ref(false)

function destination() {
  return (route.query.redirect as string) || '/app'
}

async function onSubmit(event: FormSubmitEvent<SignInInput>) {
  loading.value = true
  try {
    await signIn(event.data)
    await navigateTo(destination())
  } catch (e) {
    toast.add({ title: 'No se pudo entrar', description: authErrorMessage(e), color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    loading.value = false
  }
}

async function google() {
  loading.value = true
  try {
    await signInWithGoogle()
    await navigateTo(destination())
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
      <div class="space-y-2">
        <p class="text-primary font-mono text-[0.7rem] tracking-[0.3em] uppercase">
          Barbería · desde 2018
        </p>
        <h1 class="font-display text-4xl leading-none">Bienvenido de nuevo</h1>
      </div>
    </div>

    <UForm :schema="signInSchema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
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

      <UFormField label="Contraseña" name="password">
        <UInput
          v-model="state.password"
          type="password"
          placeholder="••••••••"
          icon="i-lucide-lock"
          size="lg"
          autocomplete="current-password"
          class="w-full"
        />
      </UFormField>

      <div class="flex justify-end">
        <NuxtLink to="/recuperar" class="text-muted hover:text-default text-sm">
          ¿Olvidaste la contraseña?
        </NuxtLink>
      </div>

      <UButton type="submit" color="primary" size="lg" block :loading="loading"> Entrar </UButton>
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
      ¿No tienes cuenta?
      <NuxtLink to="/registro" class="text-primary font-medium">Regístrate</NuxtLink>
    </p>
  </div>
</template>
