<script setup lang="ts">
import { fmtDate, initials } from '~~/lib/format'

definePageMeta({ layout: 'inner', middleware: 'auth' })
useHead({ title: 'Valorar' })

const route = useRoute()
const toast = useToast()
const user = useCurrentUser()
const { client } = useCurrentClient()
const { byDocId } = useMyAppointments()
const { create } = useReviews()
const { appt, pending } = byDocId(route.params.id as string)

const score = ref(4)
const text = ref('')
const tip = ref<number | null>(null)
const allTags = ['Puntual', 'Profesional', 'Buen ambiente', 'Limpio', 'Buen precio']
const tags = ref<string[]>(['Puntual', 'Profesional'])
const sending = ref(false)

function toggleTag(t: string) {
  tags.value = tags.value.includes(t) ? tags.value.filter((x) => x !== t) : [...tags.value, t]
}

const scoreLabel = computed(() => ['', 'Mejorable', 'Regular', 'Bien', '¡Muy bien!', '¡Excelente!'][score.value])

async function submit() {
  if (!appt.value || !user.value) return
  sending.value = true
  try {
    await create({
      clientId: user.value.uid,
      clientName: client.value?.name,
      barberId: appt.value.barberId,
      appointmentId: appt.value.id,
      score: score.value,
      tags: tags.value,
      text: text.value || undefined,
    })
    toast.add({ title: '¡Gracias por tu valoración!', icon: 'i-lucide-check', color: 'primary' })
    await navigateTo('/app')
  } catch {
    toast.add({ title: 'No se pudo enviar', color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    sending.value = false
  }
}
</script>

<template>
  <div v-if="appt" class="flex flex-1 flex-col">
    <AppBar title="Tu opinión">
      <template #right><span class="text-dimmed text-xs font-semibold">Saltar</span></template>
    </AppBar>

    <div class="flex-1 space-y-6 px-5 py-3">
      <div class="text-center">
        <div class="border-primary/40 bg-elevated mx-auto flex size-16 items-center justify-center rounded-full border text-lg font-semibold">
          {{ initials(appt.barberName) }}
        </div>
        <h1 class="font-display mt-3.5 text-2xl leading-tight">¿Qué tal con {{ appt.barberName.split(' ')[0] }}?</h1>
        <p class="text-muted mt-1.5 text-xs capitalize">{{ appt.serviceName }} · {{ fmtDate(appt.startsAt, 'd MMM') }}</p>
        <div class="mt-5 flex justify-center">
          <UiStarRating v-model="score" :size="36" />
        </div>
        <p class="text-primary mt-2.5 text-xs font-semibold">{{ scoreLabel }}</p>
      </div>

      <div>
        <p class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">¿Qué destacarías?</p>
        <div class="flex flex-wrap gap-2.5">
          <button
            v-for="t in allTags"
            :key="t"
            type="button"
            class="rounded-full border px-3.5 py-2 text-xs font-semibold"
            :class="tags.includes(t) ? 'bg-primary text-inverted border-primary' : 'bg-muted border-default text-muted'"
            @click="toggleTag(t)"
          >
            {{ t }}
          </button>
        </div>
      </div>

      <UTextarea v-model="text" :rows="3" placeholder="Cuenta tu experiencia (opcional)…" class="w-full" />

      <div class="border-default flex items-center gap-3 rounded-xl border border-dashed p-3.5">
        <UIcon name="i-lucide-gift" class="text-primary size-5" />
        <span class="text-muted flex-1 text-sm">¿Añadir propina para {{ appt.barberName.split(' ')[0] }}?</span>
        <div class="flex gap-2">
          <button
            v-for="v in [2, 3, 5]"
            :key="v"
            type="button"
            class="rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
            :class="tip === v ? 'bg-primary text-inverted border-primary' : 'bg-elevated border-default text-muted'"
            @click="tip = tip === v ? null : v"
          >
            {{ v }}€
          </button>
        </div>
      </div>
    </div>

    <div class="border-default bg-default sticky bottom-0 border-t px-5 py-3">
      <UButton color="primary" size="lg" block :loading="sending" @click="submit">Enviar valoración</UButton>
    </div>
  </div>

  <div v-else-if="pending" class="flex min-h-dvh items-center justify-center">
    <UIcon name="i-lucide-loader-circle" class="text-muted size-8 animate-spin" />
  </div>

  <div v-else class="flex min-h-dvh items-center justify-center">
    <UiEmptyState icon="i-lucide-calendar-x" title="Cita no encontrada" />
  </div>
</template>
