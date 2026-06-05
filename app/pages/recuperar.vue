<script setup lang="ts">
import { z } from 'zod'
import type { FormSubmitEvent } from '@nuxt/ui'
import { authErrorMessage } from '~~/lib/authErrors'

definePageMeta({ layout: 'auth', middleware: 'guest' })
useHead({ title: 'Recuperar acceso · JDVM' })

const { sendReset } = useAuth()

const schema = z.object({ email: z.string().email('Email inválido') })
type Schema = z.infer<typeof schema>

const state = reactive<Schema>({ email: '' })
const loading = ref(false)
const sent = ref(false)

async function onSubmit(event: FormSubmitEvent<Schema>) {
  loading.value = true
  try {
    await sendReset(event.data.email)
    sent.value = true
  } catch (e) {
    // Por privacidad mostramos éxito salvo error de formato/red.
    const code = (e as { code?: string })?.code
    if (code === 'auth/invalid-email' || code === 'auth/network-request-failed') {
      useToast().add({ title: 'No se pudo enviar', description: authErrorMessage(e), color: 'error', icon: 'i-lucide-triangle-alert' })
    } else {
      sent.value = true
    }
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
        <h1 class="font-display text-4xl leading-none">Recuperar acceso</h1>
        <p class="text-muted text-sm">Te enviaremos un enlace para restablecer tu contraseña.</p>
      </div>
    </div>

    <UiEmptyState
      v-if="sent"
      icon="i-lucide-mail-check"
      title="Revisa tu correo"
      description="Si existe una cuenta con ese email, recibirás un enlace para restablecer la contraseña."
    >
      <UButton to="/login" color="primary" variant="subtle">Volver a entrar</UButton>
    </UiEmptyState>

    <template v-else>
      <UForm :schema="schema" :state="state" class="flex flex-col gap-4" @submit="onSubmit">
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
        <UButton type="submit" color="primary" size="lg" block :loading="loading"> Enviar enlace </UButton>
      </UForm>

      <p class="text-muted text-center text-sm">
        <NuxtLink to="/login" class="text-primary font-medium">Volver a entrar</NuxtLink>
      </p>
    </template>
  </div>
</template>
