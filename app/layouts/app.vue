<template>
  <div class="bg-default text-default flex min-h-dvh flex-col font-sans antialiased">
    <!-- escritorio: barra superior · móvil: tab bar inferior -->
    <AppTopNav class="hidden lg:flex" />
    <main class="min-w-0 flex-1">
      <!-- móvil: columna centrada · escritorio: cada página controla su ancho -->
      <div class="mx-auto w-full max-w-md lg:max-w-none">
        <slot />
      </div>
    </main>
    <AppTabBar class="lg:hidden" />
  </div>
</template>
