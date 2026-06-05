<template>
  <div class="bg-default text-default relative min-h-dvh overflow-hidden font-sans antialiased">
    <UiGrain :opacity="0.35" />
    <div
      class="relative z-10 mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center gap-8 px-6 py-10"
    >
      <slot />
    </div>
  </div>
</template>
