<template>
  <div
    class="bg-default text-default relative mx-auto flex min-h-dvh w-full max-w-md flex-col font-sans antialiased"
  >
    <div class="flex flex-1 flex-col">
      <slot />
    </div>
    <AppTabBar />
  </div>
</template>
