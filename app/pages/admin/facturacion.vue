<script setup lang="ts">
import { fmtDate, formatPrice } from '~~/lib/format'
import { toDate } from '~~/lib/datetime'
import { saleMargin } from '~~/lib/finance'
import {
  EXPENSE_CATEGORIES,
  expenseCategoryLabel,
  type Expense,
  type ExpenseCategory,
  type ExpenseInput,
  type Product,
  type ProductInput,
} from '~~/schemas'

definePageMeta({ layout: 'admin', middleware: 'admin' })
useHead({ title: 'Facturación · Admin' })

const toast = useToast()
const user = useCurrentUser()
const { active: barbers } = useBarbers()
const { expenses, create: createExpense, update: updateExpense, remove: removeExpense } = useExpenses()
const { products, create: createProduct, update: updateProduct, remove: removeProduct } = useProducts()
const { sales, remove: removeSale } = useProductSales()

const tab = ref<'resumen' | 'gastos' | 'productos'>('resumen')

// — Periodo: navegación por meses (los gastos mensuales cuadran a mes natural) —
const monthOffset = ref(0)
const range = computed(() => {
  const base = new Date()
  const start = new Date(base.getFullYear(), base.getMonth() + monthOffset.value, 1)
  const end = new Date(base.getFullYear(), base.getMonth() + monthOffset.value + 1, 1)
  return { start, end }
})
const rangeStart = computed(() => range.value.start)
const rangeEnd = computed(() => range.value.end)
const monthLabel = computed(() => fmtDate(range.value.start, 'LLLL yyyy'))

const fin = useFinance(rangeStart, rangeEnd)

// Ventas del mes (para el listado de la pestaña productos).
const salesInMonth = computed(() => fin.salesInRange.value)
const barberName = (id: string) => barbers.value.find((b) => b.id === id)?.name ?? '—'

// ─────────── GASTOS ───────────
interface ExpenseForm {
  id: string | null
  concept: string
  category: ExpenseCategory
  amount: number
  recurrence: 'once' | 'monthly'
  date: string // yyyy-MM-dd
  endDate: string
  note: string
}
const toInput = (d: Date) => fmtDate(d, 'yyyy-MM-dd')
const fromInput = (s: string) => {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}
function blankExpense(): ExpenseForm {
  return { id: null, concept: '', category: 'rent', amount: 0, recurrence: 'monthly', date: toInput(new Date()), endDate: '', note: '' }
}
const expenseForm = ref<ExpenseForm | null>(null)
const savingExpense = ref(false)

function newExpense() {
  expenseForm.value = blankExpense()
}
function editExpense(e: Expense) {
  expenseForm.value = {
    id: e.id,
    concept: e.concept,
    category: e.category,
    amount: e.amount,
    recurrence: e.recurrence,
    date: toInput(toDate(e.date)),
    endDate: e.endDate ? toInput(toDate(e.endDate)) : '',
    note: e.note ?? '',
  }
}
async function saveExpense() {
  const f = expenseForm.value
  if (!f) return
  if (!f.concept.trim()) {
    toast.add({ title: 'Pon un concepto', color: 'error', icon: 'i-lucide-triangle-alert' })
    return
  }
  savingExpense.value = true
  try {
    const payload: ExpenseInput = {
      concept: f.concept.trim(),
      category: f.category,
      amount: Math.max(0, f.amount),
      recurrence: f.recurrence,
      date: fromInput(f.date),
      note: f.note,
      ...(f.recurrence === 'monthly' && f.endDate ? { endDate: fromInput(f.endDate) } : {}),
    }
    if (f.id) await updateExpense(f.id, payload)
    else await createExpense(payload)
    toast.add({ title: f.id ? 'Gasto actualizado' : 'Gasto añadido', icon: 'i-lucide-check', color: 'success' })
    expenseForm.value = null
  } catch (e) {
    toast.add({ title: 'No se pudo guardar', description: (e as Error).message, color: 'error' })
  } finally {
    savingExpense.value = false
  }
}
async function deleteExpense() {
  if (!expenseForm.value?.id) return
  if (!confirm('¿Eliminar este gasto?')) return
  await removeExpense(expenseForm.value.id)
  toast.add({ title: 'Gasto eliminado', icon: 'i-lucide-trash-2' })
  expenseForm.value = null
}
// Gastos ordenados (mensuales primero, luego por fecha desc).
const sortedExpenses = computed(() =>
  [...expenses.value].sort((a, b) => {
    if (a.recurrence !== b.recurrence) return a.recurrence === 'monthly' ? -1 : 1
    return toDate(b.date).getTime() - toDate(a.date).getTime()
  }),
)

// ─────────── PRODUCTOS ───────────
interface ProductForm {
  id: string | null
  name: string
  description: string
  costPrice: number
  salePrice: number
  stock: number
  lowStock: number
  active: boolean
}
function blankProduct(): ProductForm {
  return { id: null, name: '', description: '', costPrice: 0, salePrice: 0, stock: 0, lowStock: 3, active: true }
}
const productForm = ref<ProductForm | null>(null)
const savingProduct = ref(false)

function newProduct() {
  productForm.value = blankProduct()
}
function editProduct(p: Product) {
  productForm.value = {
    id: p.id,
    name: p.name,
    description: p.description ?? '',
    costPrice: p.costPrice,
    salePrice: p.salePrice,
    stock: p.stock,
    lowStock: p.lowStock,
    active: p.active,
  }
}
const productMargin = computed(() =>
  productForm.value ? productForm.value.salePrice - productForm.value.costPrice : 0,
)
async function saveProduct() {
  const f = productForm.value
  if (!f) return
  if (!f.name.trim()) {
    toast.add({ title: 'Pon un nombre', color: 'error', icon: 'i-lucide-triangle-alert' })
    return
  }
  savingProduct.value = true
  try {
    const payload: ProductInput = {
      name: f.name.trim(),
      description: f.description,
      costPrice: Math.max(0, f.costPrice),
      salePrice: Math.max(0, f.salePrice),
      stock: Math.max(0, Math.round(f.stock)),
      lowStock: Math.max(0, Math.round(f.lowStock)),
      active: f.active,
    }
    if (f.id) await updateProduct(f.id, payload)
    else await createProduct(payload)
    toast.add({ title: f.id ? 'Producto actualizado' : 'Producto añadido', icon: 'i-lucide-check', color: 'success' })
    productForm.value = null
  } catch (e) {
    toast.add({ title: 'No se pudo guardar', description: (e as Error).message, color: 'error' })
  } finally {
    savingProduct.value = false
  }
}
async function deleteProduct() {
  if (!productForm.value?.id) return
  if (!confirm('¿Eliminar este producto? No afecta a las ventas ya registradas.')) return
  await removeProduct(productForm.value.id)
  toast.add({ title: 'Producto eliminado', icon: 'i-lucide-trash-2' })
  productForm.value = null
}

// Modal de venta de producto (el admin elige qué barbero la hizo).
const saleOpen = ref(false)

async function undoSale(id: string) {
  const sale = sales.value.find((s) => s.id === id)
  if (!sale) return
  if (!confirm(`¿Anular la venta de ${sale.productName}? Se devolverá el stock.`)) return
  await removeSale(sale)
  toast.add({ title: 'Venta anulada', icon: 'i-lucide-undo-2' })
}
</script>

<template>
  <div>
    <AdminHeader title="Facturación" :sub="`Cuenta de resultados · ${monthLabel}`">
      <template #actions>
        <div class="border-default flex items-center overflow-hidden rounded-xl border">
          <button type="button" aria-label="Mes anterior" class="hover:bg-elevated px-2.5 py-2" @click="monthOffset--"><UIcon name="i-lucide-chevron-left" class="size-4" /></button>
          <span class="px-2 text-sm font-semibold capitalize">{{ monthLabel }}</span>
          <button type="button" aria-label="Mes siguiente" class="hover:bg-elevated px-2.5 py-2" :disabled="monthOffset >= 0" @click="monthOffset++"><UIcon name="i-lucide-chevron-right" class="size-4" /></button>
        </div>
      </template>
    </AdminHeader>

    <div class="px-5 py-6 pb-24 lg:px-7 lg:pb-6">
      <!-- tabs -->
      <div class="border-default mb-6 inline-flex rounded-xl border p-1">
        <button
          v-for="t in (['resumen', 'gastos', 'productos'] as const)"
          :key="t"
          type="button"
          class="rounded-lg px-4 py-1.5 text-sm font-semibold capitalize"
          :class="tab === t ? 'bg-primary text-inverted' : 'text-toned hover:bg-elevated'"
          @click="tab = t"
        >{{ t }}</button>
      </div>

      <!-- ░░░ RESUMEN (P&L) ░░░ -->
      <div v-if="tab === 'resumen'" class="space-y-6">
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <AdminCard>
            <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Ingresos (caja)</p>
            <p class="font-display mt-1 text-3xl">{{ formatPrice(Math.round(fin.grossIncome.value)) }}</p>
            <p class="text-dimmed mt-1 text-xs">servicios + productos</p>
          </AdminCard>
          <AdminCard>
            <p class="text-dimmed font-mono text-[0.6rem] tracking-widest uppercase">Gastos</p>
            <p class="font-display text-error mt-1 text-3xl">{{ formatPrice(Math.round(fin.expensesTotal.value)) }}</p>
            <p class="text-dimmed mt-1 text-xs">gastos + comisiones + coste prod.</p>
          </AdminCard>
          <AdminCard class="border-primary/40" style="background: linear-gradient(135deg, var(--jdvm-bg-2), var(--jdvm-bg-1))">
            <p class="text-primary font-mono text-[0.6rem] tracking-widest uppercase">Beneficio neto</p>
            <p class="font-display mt-1 text-4xl" :class="fin.netProfit.value < 0 ? 'text-error' : ''">{{ formatPrice(Math.round(fin.netProfit.value)) }}</p>
            <p class="text-dimmed mt-1 text-xs">lo que le queda al local</p>
          </AdminCard>
        </div>

        <!-- desglose P&L -->
        <AdminCard :pad="false">
          <div class="border-default font-display border-b px-5 py-4 text-lg">Desglose del mes</div>
          <div class="divide-default divide-y px-5">
            <div class="flex items-center justify-between py-3 text-sm">
              <span class="flex items-center gap-2"><UIcon name="i-lucide-scissors" class="text-primary size-4" />Ingresos por servicios</span>
              <span class="font-mono">{{ formatPrice(Math.round(fin.serviceRevenue.value)) }}</span>
            </div>
            <div class="flex items-center justify-between py-3 text-sm">
              <span class="flex items-center gap-2"><UIcon name="i-lucide-shopping-bag" class="text-primary size-4" />Ingresos por productos</span>
              <span class="font-mono">{{ formatPrice(Math.round(fin.productRevenue.value)) }}</span>
            </div>
            <div class="text-error flex items-center justify-between py-3 text-sm">
              <span class="flex items-center gap-2"><UIcon name="i-lucide-percent" class="size-4" />− Comisiones de barberos</span>
              <span class="font-mono">−{{ formatPrice(Math.round(fin.barberCommissions.value)) }}</span>
            </div>
            <div class="text-error flex items-center justify-between py-3 text-sm">
              <span class="flex items-center gap-2"><UIcon name="i-lucide-package" class="size-4" />− Coste de productos vendidos</span>
              <span class="font-mono">−{{ formatPrice(Math.round(fin.productCost.value)) }}</span>
            </div>
            <div class="text-error flex items-center justify-between py-3 text-sm">
              <span class="flex items-center gap-2"><UIcon name="i-lucide-receipt" class="size-4" />− Gastos del negocio</span>
              <span class="font-mono">−{{ formatPrice(Math.round(fin.expensesTotal.value)) }}</span>
            </div>
            <div class="flex items-center justify-between py-4">
              <span class="font-semibold">Beneficio neto</span>
              <span class="font-display text-2xl" :class="fin.netProfit.value < 0 ? 'text-error' : 'text-primary'">{{ formatPrice(Math.round(fin.netProfit.value)) }}</span>
            </div>
          </div>
        </AdminCard>

        <!-- cobros por método (arqueo de caja) -->
        <AdminCard :pad="false">
          <div class="border-default font-display border-b px-5 py-4 text-lg">Cobros por método</div>
          <div class="divide-default divide-y px-5">
            <div class="flex items-center justify-between py-3 text-sm">
              <span class="flex items-center gap-2"><UIcon name="i-lucide-banknote" class="text-primary size-4" />Efectivo</span>
              <span class="font-mono">{{ formatPrice(Math.round(fin.collectedByMethod.value.cash)) }}</span>
            </div>
            <div class="flex items-center justify-between py-3 text-sm">
              <span class="flex items-center gap-2"><UIcon name="i-lucide-credit-card" class="text-primary size-4" />Tarjeta / Revolut</span>
              <span class="font-mono">{{ formatPrice(Math.round(fin.collectedByMethod.value.card)) }}</span>
            </div>
            <div class="flex items-center justify-between py-3.5">
              <span class="font-semibold">Total en caja</span>
              <span class="font-display text-xl">{{ formatPrice(Math.round(fin.grossIncome.value)) }}</span>
            </div>
          </div>
        </AdminCard>

        <!-- gastos por categoría -->
        <AdminCard v-if="fin.expensesByCategory.value.length">
          <h3 class="font-display mb-3 text-lg">Gastos por categoría</h3>
          <div class="space-y-2">
            <div v-for="c in fin.expensesByCategory.value" :key="c.id" class="flex items-center gap-3 text-sm">
              <UIcon :name="c.icon" class="text-dimmed size-4" />
              <span class="flex-1">{{ c.name }}</span>
              <span class="font-mono">{{ formatPrice(Math.round(c.amount)) }}</span>
            </div>
          </div>
        </AdminCard>
      </div>

      <!-- ░░░ GASTOS ░░░ -->
      <div v-else-if="tab === 'gastos'" class="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <AdminCard :pad="false">
          <div class="border-default flex items-center justify-between border-b px-5 py-4">
            <span class="font-display text-lg">Gastos</span>
            <UButton size="sm" color="primary" icon="i-lucide-plus" @click="newExpense">Añadir gasto</UButton>
          </div>
          <div v-if="sortedExpenses.length">
            <button
              v-for="e in sortedExpenses"
              :key="e.id"
              type="button"
              class="border-default hover:bg-elevated flex w-full items-center gap-3 border-b px-5 py-3.5 text-left last:border-b-0"
              :class="expenseForm?.id === e.id ? 'bg-primary/5' : ''"
              @click="editExpense(e)"
            >
              <div class="bg-accented flex size-9 items-center justify-center rounded-lg">
                <UIcon :name="EXPENSE_CATEGORIES.find((c) => c.id === e.category)?.icon ?? 'i-lucide-receipt'" class="text-primary size-4" />
              </div>
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-semibold">{{ e.concept }}</p>
                <p class="text-dimmed text-xs">
                  {{ expenseCategoryLabel(e.category) }} ·
                  <span v-if="e.recurrence === 'monthly'" class="text-primary">mensual</span>
                  <span v-else>{{ fmtDate(toDate(e.date), 'd MMM yyyy') }}</span>
                </p>
              </div>
              <span class="font-display text-lg">{{ formatPrice(e.amount) }}</span>
            </button>
          </div>
          <UiEmptyState v-else icon="i-lucide-receipt" title="Sin gastos" description="Añade alquiler, suministros, autónomo…" class="py-10" />
        </AdminCard>

        <!-- editor de gasto -->
        <AdminCard v-if="expenseForm" :pad="false" class="lg:sticky lg:top-22">
          <div class="border-default flex items-center justify-between border-b px-5 py-4">
            <span class="font-display text-lg">{{ expenseForm.id ? 'Editar gasto' : 'Nuevo gasto' }}</span>
            <button type="button" class="text-muted" aria-label="Cerrar" @click="expenseForm = null"><UIcon name="i-lucide-x" class="size-5" /></button>
          </div>
          <div class="space-y-4 px-5 py-4">
            <UFormField label="Concepto"><UInput v-model="expenseForm.concept" placeholder="Alquiler del local" class="w-full" /></UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField label="Categoría">
                <select v-model="expenseForm.category" class="border-default bg-default w-full rounded-lg border px-3 py-2 text-sm">
                  <option v-for="c in EXPENSE_CATEGORIES" :key="c.id" :value="c.id">{{ c.name }}</option>
                </select>
              </UFormField>
              <UFormField label="Importe (€)"><UInput v-model.number="expenseForm.amount" type="number" min="0" step="1" class="w-full" /></UFormField>
            </div>
            <UFormField label="Tipo">
              <div class="grid grid-cols-2 gap-2">
                <button type="button" class="rounded-xl border px-3 py-2 text-sm font-semibold" :class="expenseForm.recurrence === 'monthly' ? 'border-primary bg-primary/10 text-primary' : 'border-default text-toned'" @click="expenseForm.recurrence = 'monthly'">Mensual</button>
                <button type="button" class="rounded-xl border px-3 py-2 text-sm font-semibold" :class="expenseForm.recurrence === 'once' ? 'border-primary bg-primary/10 text-primary' : 'border-default text-toned'" @click="expenseForm.recurrence = 'once'">Puntual</button>
              </div>
            </UFormField>
            <div class="grid grid-cols-2 gap-3">
              <UFormField :label="expenseForm.recurrence === 'monthly' ? 'Desde' : 'Fecha'">
                <UInput v-model="expenseForm.date" type="date" class="w-full" />
              </UFormField>
              <UFormField v-if="expenseForm.recurrence === 'monthly'" label="Hasta (opcional)">
                <UInput v-model="expenseForm.endDate" type="date" class="w-full" />
              </UFormField>
            </div>
            <UFormField label="Nota (opcional)"><UInput v-model="expenseForm.note" placeholder="Referencia, proveedor…" class="w-full" /></UFormField>
            <div class="flex items-center gap-2 pt-1">
              <UButton color="primary" :loading="savingExpense" icon="i-lucide-check" @click="saveExpense">Guardar</UButton>
              <UButton v-if="expenseForm.id" color="error" variant="ghost" icon="i-lucide-trash-2" @click="deleteExpense">Eliminar</UButton>
            </div>
          </div>
        </AdminCard>
      </div>

      <!-- ░░░ PRODUCTOS ░░░ -->
      <div v-else class="space-y-6">
        <div class="flex flex-wrap items-center justify-between gap-3">
          <p class="text-dimmed text-sm">{{ products.length }} productos · {{ fin.productUnits.value }} vendidos en {{ monthLabel }}</p>
          <div class="flex gap-2">
            <UButton color="primary" variant="soft" icon="i-lucide-shopping-cart" :disabled="!products.length" @click="saleOpen = true">Registrar venta</UButton>
            <UButton color="primary" icon="i-lucide-plus" @click="newProduct">Añadir producto</UButton>
          </div>
        </div>

        <div class="grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
          <div class="space-y-6">
            <!-- catálogo -->
            <AdminCard :pad="false">
              <div class="border-default font-display border-b px-5 py-4 text-lg">Catálogo</div>
              <div v-if="products.length">
                <button
                  v-for="p in products"
                  :key="p.id"
                  type="button"
                  class="border-default hover:bg-elevated flex w-full items-center gap-3 border-b px-5 py-3.5 text-left last:border-b-0"
                  :class="productForm?.id === p.id ? 'bg-primary/5' : ''"
                  @click="editProduct(p)"
                >
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-semibold" :class="!p.active ? 'text-dimmed' : ''">{{ p.name }}</p>
                    <p class="text-dimmed text-xs">
                      Coste {{ formatPrice(p.costPrice) }} · Margen {{ formatPrice(p.salePrice - p.costPrice) }}
                    </p>
                  </div>
                  <span class="rounded-md px-1.5 py-0.5 font-mono text-[0.65rem]" :class="p.stock <= p.lowStock ? 'bg-error/15 text-error' : 'bg-accented text-dimmed'">{{ p.stock }} ud.</span>
                  <span class="font-display w-16 text-right text-lg">{{ formatPrice(p.salePrice) }}</span>
                </button>
              </div>
              <UiEmptyState v-else icon="i-lucide-package" title="Sin productos" description="Añade ceras, champús, etc." class="py-10" />
            </AdminCard>

            <!-- ventas del mes -->
            <AdminCard :pad="false">
              <div class="border-default font-display border-b px-5 py-4 text-lg">Ventas · {{ monthLabel }}</div>
              <div v-if="salesInMonth.length" class="max-h-80 overflow-y-auto">
                <div v-for="s in salesInMonth" :key="s.id" class="border-default flex items-center gap-3 border-b px-5 py-3 text-sm last:border-b-0">
                  <div class="min-w-0 flex-1">
                    <p class="truncate font-medium">{{ s.qty }}× {{ s.productName }}</p>
                    <p class="text-dimmed text-xs">{{ fmtDate(toDate(s.soldAt), 'd MMM · HH:mm') }} · {{ barberName(s.barberId) }}</p>
                  </div>
                  <span class="text-success font-mono text-xs">+{{ formatPrice(saleMargin(s)) }}</span>
                  <span class="font-display w-14 text-right">{{ formatPrice(s.unitPrice * s.qty) }}</span>
                  <button type="button" class="text-dimmed hover:text-error" aria-label="Anular" @click="undoSale(s.id)"><UIcon name="i-lucide-x" class="size-4" /></button>
                </div>
              </div>
              <UiEmptyState v-else icon="i-lucide-shopping-cart" title="Sin ventas este mes" description="Registra una venta con el botón de arriba." class="py-8" />
            </AdminCard>
          </div>

          <!-- editor de producto -->
          <AdminCard v-if="productForm" :pad="false" class="lg:sticky lg:top-22">
            <div class="border-default flex items-center justify-between border-b px-5 py-4">
              <span class="font-display text-lg">{{ productForm.id ? 'Editar producto' : 'Nuevo producto' }}</span>
              <button type="button" class="text-muted" aria-label="Cerrar" @click="productForm = null"><UIcon name="i-lucide-x" class="size-5" /></button>
            </div>
            <div class="space-y-4 px-5 py-4">
              <UFormField label="Nombre"><UInput v-model="productForm.name" placeholder="Cera mate 100ml" class="w-full" /></UFormField>
              <UFormField label="Descripción (opcional)"><UInput v-model="productForm.description" class="w-full" /></UFormField>
              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Coste/unidad (€)"><UInput v-model.number="productForm.costPrice" type="number" min="0" step="0.5" class="w-full" /></UFormField>
                <UFormField label="Precio venta (€)"><UInput v-model.number="productForm.salePrice" type="number" min="0" step="0.5" class="w-full" /></UFormField>
              </div>
              <div class="border-default bg-muted flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                <span class="text-dimmed">Margen por unidad</span>
                <span class="font-display" :class="productMargin < 0 ? 'text-error' : 'text-primary'">{{ formatPrice(productMargin) }}</span>
              </div>
              <div class="grid grid-cols-2 gap-3">
                <UFormField label="Stock (uds.)"><UInput v-model.number="productForm.stock" type="number" min="0" step="1" class="w-full" /></UFormField>
                <UFormField label="Aviso stock bajo"><UInput v-model.number="productForm.lowStock" type="number" min="0" step="1" class="w-full" /></UFormField>
              </div>
              <div class="border-default bg-muted flex items-center justify-between rounded-xl border p-3">
                <div><p class="text-sm font-semibold">Activo</p><p class="text-dimmed text-xs">Disponible para vender</p></div>
                <USwitch v-model="productForm.active" />
              </div>
              <div class="flex items-center gap-2 pt-1">
                <UButton color="primary" :loading="savingProduct" icon="i-lucide-check" @click="saveProduct">Guardar</UButton>
                <UButton v-if="productForm.id" color="error" variant="ghost" icon="i-lucide-trash-2" @click="deleteProduct">Eliminar</UButton>
              </div>
            </div>
          </AdminCard>
        </div>
      </div>
    </div>

    <ProductSaleModal v-model:open="saleOpen" :default-seller="user?.uid ?? ''" :sellers="barbers" />
  </div>
</template>
