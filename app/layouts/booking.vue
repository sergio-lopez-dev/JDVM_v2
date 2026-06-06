<template>
  <div class="bg-default text-default flex min-h-dvh flex-col font-sans antialiased">
    <!-- escritorio: barra superior · móvil: flujo enfocado con su propio back -->
    <AppTopNav class="hidden lg:flex" />
    <main class="min-w-0 flex-1 lg:flex lg:flex-col">
      <!-- móvil: columna centrada a altura completa · escritorio: ancho libre -->
      <div class="mx-auto flex min-h-dvh w-full max-w-md flex-col lg:min-h-0 lg:max-w-none lg:flex-1">
        <slot />
      </div>
    </main>
  </div>
</template>
