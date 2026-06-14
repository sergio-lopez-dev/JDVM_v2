<script setup lang="ts">
// Catch-all de MENOR prioridad: cualquier ruta inexistente reenvía a la página
// principal (login en '/') en vez de mostrar un 404. Las rutas definidas y las
// dinámicas (p. ej. /barbero/[slug], /citas/[id]) son más específicas y ganan a
// este comodín. `replace` evita dejar la URL errónea en el historial.
await navigateTo('/', { replace: true })
</script>

<template>
  <div />
</template>
