<script setup lang="ts">
import { formatPrice } from '~~/lib/format'
import { PAYMENT_METHODS, type Barber, type PaymentMethod } from '~~/schemas'

const props = defineProps<{
  open: boolean
  // uid de quien registra la venta (barbero logueado, o admin).
  defaultSeller: string
  // Si se pasa, se muestra selector de "vendido por" (contexto admin).
  sellers?: Barber[]
}>()
const emit = defineEmits<{ 'update:open': [boolean]; sold: [] }>()

const toast = useToast()
const { active: products } = useProducts()
const { sell } = useProductSales()

const productId = ref('')
const qty = ref(1)
const payment = ref<PaymentMethod>('cash')
const sellerId = ref('')
const saving = ref(false)

const PAYMENT_LABEL: Record<PaymentMethod, string> = { cash: 'Efectivo', revolut: 'Revolut' }

const product = computed(() => products.value.find((p) => p.id === productId.value) ?? null)
const maxQty = computed(() => Math.max(1, product.value?.stock ?? 1))
const total = computed(() => (product.value ? product.value.salePrice * qty.value : 0))

watch(
  () => props.open,
  (o) => {
    if (o) {
      productId.value = ''
      qty.value = 1
      payment.value = 'cash'
      sellerId.value = props.defaultSeller
    }
  },
)
watch(maxQty, (m) => {
  if (qty.value > m) qty.value = m
})

async function confirm() {
  if (!product.value) {
    toast.add({ title: 'Elige un producto', color: 'error', icon: 'i-lucide-triangle-alert' })
    return
  }
  if (product.value.stock <= 0) {
    toast.add({ title: 'Sin stock', color: 'error', icon: 'i-lucide-triangle-alert' })
    return
  }
  saving.value = true
  try {
    await sell(product.value, {
      qty: qty.value,
      barberId: sellerId.value || props.defaultSeller,
      paymentMethod: payment.value,
    })
    toast.add({ title: 'Venta registrada', description: `${product.value.name} · ${formatPrice(total.value)}`, icon: 'i-lucide-check', color: 'success' })
    emit('sold')
    emit('update:open', false)
  } catch (e) {
    toast.add({ title: 'No se pudo registrar', description: (e as Error).message, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Transition enter-active-class="transition-opacity" leave-active-class="transition-opacity" enter-from-class="opacity-0" leave-to-class="opacity-0">
    <div v-if="open" class="fixed inset-0 z-50 flex items-end justify-center sm:items-center" @click="emit('update:open', false)">
      <div class="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div class="border-default bg-default relative flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl border sm:rounded-3xl" @click.stop>
        <header class="border-default flex items-center justify-between border-b px-5 py-4">
          <div>
            <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Producto</p>
            <h2 class="font-display text-xl">Registrar venta</h2>
          </div>
          <button type="button" aria-label="Cerrar" class="text-muted flex size-8 items-center justify-center" @click="emit('update:open', false)">
            <UIcon name="i-lucide-x" class="size-5" />
          </button>
        </header>

        <div class="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <!-- producto -->
          <div>
            <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Producto</label>
            <div v-if="products.length" class="border-default max-h-56 overflow-y-auto rounded-xl border">
              <button
                v-for="p in products"
                :key="p.id"
                type="button"
                :disabled="p.stock <= 0"
                class="border-default flex w-full items-center gap-3 border-b px-3 py-2.5 text-left last:border-b-0 disabled:opacity-40"
                :class="productId === p.id ? 'bg-primary/10' : 'hover:bg-elevated'"
                @click="productId = p.id"
              >
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-semibold">{{ p.name }}</p>
                  <p class="text-dimmed text-xs">{{ p.stock > 0 ? `${p.stock} en stock` : 'Sin stock' }}</p>
                </div>
                <span class="font-display text-base">{{ formatPrice(p.salePrice) }}</span>
              </button>
            </div>
            <UiEmptyState v-else icon="i-lucide-package" title="Sin productos" description="Crea productos en Facturación → Productos." />
          </div>

          <template v-if="product">
            <!-- cantidad -->
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">Cantidad</span>
              <div class="border-default flex items-center gap-3 rounded-xl border px-2 py-1.5">
                <button type="button" class="text-muted size-7 text-lg" :disabled="qty <= 1" @click="qty = Math.max(1, qty - 1)">−</button>
                <span class="font-display w-6 text-center text-lg">{{ qty }}</span>
                <button type="button" class="text-muted size-7 text-lg" :disabled="qty >= maxQty" @click="qty = Math.min(maxQty, qty + 1)">+</button>
              </div>
            </div>

            <!-- pago -->
            <div>
              <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Pago</label>
              <div class="grid grid-cols-2 gap-2">
                <button
                  v-for="m in PAYMENT_METHODS"
                  :key="m"
                  type="button"
                  class="rounded-xl border px-3 py-2 text-sm font-semibold"
                  :class="payment === m ? 'border-primary bg-primary/10 text-primary' : 'border-default text-toned'"
                  @click="payment = m"
                >{{ PAYMENT_LABEL[m] }}</button>
              </div>
            </div>

            <!-- vendido por (solo admin) -->
            <div v-if="sellers?.length">
              <label class="text-dimmed mb-1.5 block font-mono text-[0.6rem] tracking-widest uppercase">Vendido por</label>
              <select v-model="sellerId" class="border-default bg-default w-full rounded-xl border px-3 py-2 text-sm">
                <option v-for="b in sellers" :key="b.id" :value="b.id">{{ b.name }}</option>
              </select>
            </div>
          </template>
        </div>

        <footer class="border-default flex items-center justify-between gap-3 border-t px-5 py-4">
          <div>
            <p class="text-dimmed text-xs">Total</p>
            <p class="font-display text-2xl">{{ formatPrice(total) }}</p>
          </div>
          <UButton color="primary" size="lg" :disabled="!product" :loading="saving" icon="i-lucide-check" @click="confirm">Registrar venta</UButton>
        </footer>
      </div>
    </div>
  </Transition>
</template>
