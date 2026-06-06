<template>
  <div class="bg-default text-default flex min-h-dvh flex-col font-sans antialiased">
    <!-- escritorio: barra superior del cliente (en móvil cada flujo trae su back) -->
    <AppTopNav class="hidden lg:flex" />
    <main class="min-w-0 flex-1">
      <!-- flujos enfocados: columna centrada, algo más ancha en escritorio -->
      <div class="mx-auto flex min-h-dvh w-full max-w-md flex-col lg:min-h-0 lg:max-w-2xl lg:py-8">
        <slot />
      </div>
    </main>
  </div>
</template>
