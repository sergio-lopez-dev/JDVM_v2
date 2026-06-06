<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import { completeProfileSchema, type CompleteProfileInput } from '~~/schemas'
import { normalizePhone } from '~~/lib/phone'

definePageMeta({ layout: 'auth', middleware: 'auth' })
useHead({ title: 'Completa tu perfil' })

const toast = useToast()
const user = useCurrentUser()
const { client } = useCurrentClient()
const { updateProfile } = useClients()
const { name: studioName } = useStudio()

const state = reactive<CompleteProfileInput>({ name: '', phone: '' })
const loading = ref(false)

// Prefill con lo que ya tengamos (nombre de Google / doc existente).
watchEffect(() => {
  if (!state.name) state.name = client.value?.name || user.value?.displayName || ''
})
watch(
  () => state.phone,
  (v) => {
    const clean = normalizePhone(v)
    if (clean !== v) state.phone = clean
  },
)

async function onSubmit(event: FormSubmitEvent<CompleteProfileInput>) {
  if (!user.value) return
  loading.value = true
  try {
    await updateProfile(user.value.uid, event.data)
    await navigateTo('/app')
  } catch {
    toast.add({ title: 'No se pudo guardar', color: 'error', icon: 'i-lucide-triangle-alert' })
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
        <p class="font-display text-xl leading-none">{{ studioName }}</p>
        <h1 class="font-display text-4xl leading-none">Casi listo</h1>
        <p class="text-muted text-sm">Solo necesitamos un par de datos para tus reservas.</p>
      </div>
    </div>

    <UForm
      :schema="completeProfileSchema"
      :state="state"
      class="flex flex-col gap-4"
      @submit="onSubmit"
    >
      <UFormField label="Nombre" name="name">
        <UInput v-model="state.name" placeholder="Tu nombre" icon="i-lucide-user" size="lg" class="w-full" />
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

      <UButton type="submit" color="primary" size="lg" block :loading="loading"> Continuar </UButton>
    </UForm>
  </div>
</template>
