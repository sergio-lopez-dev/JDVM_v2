<script setup lang="ts">
// Partículas flotantes (polvo dorado) sobre canvas. Ligero, sin dependencias,
// respeta prefers-reduced-motion. Pensado como capa de fondo (pointer-events:none).
const props = withDefaults(defineProps<{ count?: number; color?: string }>(), {
  count: 42,
  color: '194, 162, 78', // rgb del dorado de marca
})

const canvas = ref<HTMLCanvasElement | null>(null)
let raf = 0
let ctx: CanvasRenderingContext2D | null = null
let parts: { x: number; y: number; r: number; vy: number; vx: number; a: number; ph: number }[] = []
let w = 0
let h = 0

const rnd = (a: number, b: number) => a + Math.random() * (b - a)

function resize() {
  const el = canvas.value
  if (!el || !ctx) return
  const rect = el.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  w = rect.width
  h = rect.height
  el.width = Math.max(1, Math.round(w * dpr))
  el.height = Math.max(1, Math.round(h * dpr))
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
}

function init() {
  parts = Array.from({ length: props.count }, () => ({
    x: rnd(0, w),
    y: rnd(0, h),
    r: rnd(0.6, 2.3),
    vy: rnd(-0.28, -0.05),
    vx: rnd(-0.1, 0.1),
    a: rnd(0.06, 0.5),
    ph: rnd(0, Math.PI * 2),
  }))
}

function draw(t: number) {
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  for (const p of parts) {
    p.y += p.vy
    p.x += p.vx + Math.sin(t / 2200 + p.ph) * 0.14
    if (p.y < -6) {
      p.y = h + 6
      p.x = rnd(0, w)
    }
    if (p.x < -6) p.x = w + 6
    else if (p.x > w + 6) p.x = -6
    ctx.beginPath()
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(${props.color}, ${p.a})`
    ctx.fill()
  }
}

function loop(t: number) {
  draw(t)
  raf = requestAnimationFrame(loop)
}

function onResize() {
  resize()
  init()
}

onMounted(() => {
  const el = canvas.value
  if (!el) return
  ctx = el.getContext('2d')
  resize()
  init()
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (reduced) draw(0)
  else raf = requestAnimationFrame(loop)
  window.addEventListener('resize', onResize, { passive: true })
})

onBeforeUnmount(() => {
  cancelAnimationFrame(raf)
  window.removeEventListener('resize', onResize)
})
</script>

<template>
  <canvas ref="canvas" class="pointer-events-none block size-full" aria-hidden="true" />
</template>
