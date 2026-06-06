<template>
  <div class="bg-default text-default flex min-h-dvh font-sans antialiased">
    <BarberSideNav />
    <div class="flex min-w-0 flex-1 flex-col">
      <main class="min-w-0 flex-1">
        <div class="mx-auto w-full max-w-md lg:max-w-none">
          <slot />
        </div>
      </main>
      <BarberTabBar class="lg:hidden" />
    </div>
  </div>
</template>
