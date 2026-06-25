<script setup lang="ts">
// Tarjeta para activar las notificaciones push (recordatorios y avisos de citas).
// Se usa en los perfiles de cliente, barbero y admin.
const { supported, permission, enabled, enabling, iosNeedsInstall, enable, disable } =
  useMessaging()
</script>

<template>
  <div class="border-default bg-muted rounded-2xl border p-4">
    <div class="flex items-start gap-3">
      <div class="bg-primary/15 flex size-10 shrink-0 items-center justify-center rounded-xl">
        <UIcon name="i-lucide-bell-ring" class="text-primary size-5" />
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-semibold">Notificaciones</p>
        <p class="text-dimmed mt-0.5 text-xs leading-relaxed">
          Recordatorios de tus citas y avisos de cambios, directos al móvil.
        </p>

        <!-- iOS sin instalar -->
        <p v-if="iosNeedsInstall" class="text-warning mt-2 text-xs">
          En iPhone: añade primero la app a tu pantalla de inicio (Compartir → «Añadir a inicio») y
          vuelve aquí para activarlas.
        </p>
        <!-- no soportado -->
        <p v-else-if="!supported" class="text-dimmed mt-2 text-xs">
          Tu navegador no admite notificaciones push.
        </p>
        <!-- bloqueadas -->
        <p v-else-if="permission === 'denied'" class="text-error mt-2 text-xs">
          Las has bloqueado en el navegador. Actívalas en los ajustes del sitio.
        </p>

        <div v-if="supported && permission !== 'denied'" class="mt-3 flex items-center gap-2">
          <UButton
            v-if="!enabled"
            color="primary"
            size="sm"
            icon="i-lucide-bell"
            :loading="enabling"
            @click="enable"
          >
            Activar notificaciones
          </UButton>
          <template v-else>
            <span class="text-success inline-flex items-center gap-1.5 text-sm font-semibold">
              <UIcon name="i-lucide-check-circle" class="size-4" />Activadas
            </span>
            <UButton color="neutral" variant="ghost" size="xs" @click="disable">Desactivar</UButton>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
