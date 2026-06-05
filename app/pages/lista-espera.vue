<script setup lang="ts">
import { formatDuration, formatPrice } from '~~/lib/format'

definePageMeta({ layout: 'inner', middleware: 'auth' })
useHead({ title: 'Lista de espera · JDVM' })

const route = useRoute()
const user = useCurrentUser()
const toast = useToast()
const { publicServices } = useServices()
const { mine, alreadyOnList, join, leave } = useWaitlist()

const serviceId = ref<string>((route.query.service as string) || '')
watchEffect(() => {
  if (!serviceId.value && publicServices.value.length) serviceId.value = publicServices.value[0]!.id
})
const service = computed(() => publicServices.value.find((s) => s.id === serviceId.value) ?? null)

const prefs = reactive({ anyBarber: true, afternoonOnly: true, weekdaysOnly: false })
const busy = ref(false)

async function joinList() {
  if (!user.value || !service.value) return
  busy.value = true
  try {
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const end = new Date(start)
    end.setDate(end.getDate() + 14)
    await join({
      clientId: user.value.uid,
      serviceId: service.value.id,
      preferredBarberId: prefs.anyBarber ? null : null,
      timeRange: prefs.afternoonOnly ? { start: '16:00', end: '22:00' } : { start: '10:00', end: '22:00' },
      preferredDates: { start, end },
      notified: false,
    })
    toast.add({ title: 'Estás en la lista', description: 'Te avisaremos cuando se libere un hueco.', icon: 'i-lucide-bell', color: 'primary' })
  } catch {
    toast.add({ title: 'No se pudo unir', color: 'error', icon: 'i-lucide-triangle-alert' })
  } finally {
    busy.value = false
  }
}

async function leaveList() {
  const entry = mine.value[0]
  if (entry) await leave(entry.id)
}
</script>

<template>
  <div class="flex flex-1 flex-col">
    <AppBar title="Lista de espera" />

    <div class="flex-1 space-y-5 px-5 py-3">
      <div class="py-3 text-center">
        <div class="bg-primary/15 border-primary/30 mx-auto flex size-20 items-center justify-center rounded-full border">
          <UIcon name="i-lucide-bell" class="text-primary size-8" />
        </div>
        <h1 class="font-display mt-4 text-3xl leading-tight">
          {{ alreadyOnList ? 'Estás en la lista' : 'Únete a la lista' }}
        </h1>
        <p class="text-muted mx-auto mt-2 max-w-xs text-sm leading-relaxed">
          Te avisaremos en cuanto se libere un hueco que encaje con tus preferencias.
        </p>
      </div>

      <!-- posición (placeholder hasta el matching de la Cloud Function) -->
      <div v-if="alreadyOnList" class="border-default bg-muted flex overflow-hidden rounded-2xl border">
        <div v-for="(s, i) in [['nº 3', 'En cola'], ['~2 días', 'Espera media'], ['Jue', 'Día objetivo']]" :key="s[1]" class="flex-1 px-2 py-4 text-center" :class="i ? 'border-default border-l' : ''">
          <p class="text-primary font-display text-xl">{{ s[0] }}</p>
          <p class="text-dimmed mt-1 text-[0.65rem]">{{ s[1] }}</p>
        </div>
      </div>

      <!-- servicio objetivo -->
      <div class="border-default bg-muted rounded-2xl border p-4">
        <p class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">Buscas</p>
        <div class="flex items-center gap-3">
          <div class="bg-primary/15 flex size-9 items-center justify-center rounded-lg">
            <UIcon name="i-lucide-scissors" class="text-primary size-4" />
          </div>
          <div class="flex-1">
            <USelect
              v-if="!alreadyOnList"
              v-model="serviceId"
              :items="publicServices.map((s) => ({ label: s.name, value: s.id }))"
              class="w-full"
            />
            <template v-else>
              <p class="text-sm font-semibold">{{ service?.name }}</p>
            </template>
            <p v-if="service" class="text-dimmed mt-0.5 font-mono text-[0.65rem]">
              {{ formatDuration(service.durationMinutes) }} · {{ formatPrice(service.basePrice) }}
            </p>
          </div>
        </div>
      </div>

      <!-- preferencias -->
      <div v-if="!alreadyOnList">
        <p class="text-dimmed mb-3 font-mono text-[0.6rem] tracking-widest uppercase">Avísame si…</p>
        <div class="border-default overflow-hidden rounded-2xl border">
          <div class="flex items-center px-4 py-3.5"><span class="flex-1 text-sm font-medium">Cualquier barbero</span><USwitch v-model="prefs.anyBarber" /></div>
          <div class="border-default flex items-center border-t px-4 py-3.5"><span class="flex-1 text-sm font-medium">Solo tardes</span><USwitch v-model="prefs.afternoonOnly" /></div>
          <div class="border-default flex items-center border-t px-4 py-3.5"><span class="flex-1 text-sm font-medium">Lun a vie</span><USwitch v-model="prefs.weekdaysOnly" /></div>
        </div>
      </div>
    </div>

    <div class="border-default bg-default sticky bottom-0 border-t px-5 py-3">
      <UButton v-if="alreadyOnList" color="error" variant="outline" size="lg" block @click="leaveList">Salir de la lista</UButton>
      <UButton v-else color="primary" size="lg" block :loading="busy" icon="i-lucide-bell" @click="joinList">Unirme a la lista</UButton>
    </div>
  </div>
</template>
