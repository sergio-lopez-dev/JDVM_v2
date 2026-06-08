import { toDate } from '~~/lib/datetime'
import { expenseAmountInRange } from '~~/lib/finance'
import { EXPENSE_CATEGORIES } from '~~/schemas'
import type { Expense } from '~~/schemas'

// Cuenta de resultados (P&L) del local en un rango [start, end):
//   ingresos servicios (bruto) − comisiones barberos
//   + margen de productos (precio − coste)
//   − gastos
//   = beneficio neto del local
// Reutiliza useAdminStats para los ingresos por servicio y por barbero.
export function useFinance(start: Ref<Date>, end: Ref<Date>) {
  const { totals: apptTotals, perBarber } = useAdminStats(start, end)
  const { barbers } = useBarbers()
  const { expenses } = useExpenses()
  const { sales } = useProductSales()

  const inRange = (d: unknown) => {
    const t = d ? toDate(d as Date).getTime() : null
    return t != null && t >= start.value.getTime() && t < end.value.getTime()
  }

  const serviceRevenue = computed(() => apptTotals.value.revenue)

  // Comisiones de barberos = facturación de cada barbero × su % (coste para el local).
  const barberCommissions = computed(() =>
    perBarber.value.reduce((sum, row) => {
      const pct = barbers.value.find((b) => b.id === row.id)?.commissionPercent ?? 50
      return sum + (row.revenue * pct) / 100
    }, 0),
  )

  const salesInRange = computed(() => sales.value.filter((s) => inRange(s.soldAt)))
  const productRevenue = computed(() =>
    salesInRange.value.reduce((s, x) => s + x.unitPrice * x.qty, 0),
  )
  const productCost = computed(() => salesInRange.value.reduce((s, x) => s + x.unitCost * x.qty, 0))
  const productMargin = computed(() => productRevenue.value - productCost.value)
  const productUnits = computed(() => salesInRange.value.reduce((s, x) => s + x.qty, 0))

  const expensesInRange = (e: Expense) => expenseAmountInRange(e, start.value, end.value)
  const expensesTotal = computed(() =>
    expenses.value.reduce((s, e) => s + expensesInRange(e), 0),
  )
  const expensesByCategory = computed(() =>
    EXPENSE_CATEGORIES.map((c) => ({
      ...c,
      amount: expenses.value
        .filter((e) => e.category === c.id)
        .reduce((s, e) => s + expensesInRange(e), 0),
    })).filter((c) => c.amount > 0),
  )

  // Beneficio neto del local en el periodo.
  const netProfit = computed(
    () =>
      serviceRevenue.value -
      barberCommissions.value +
      productMargin.value -
      expensesTotal.value,
  )
  // Ingreso total que entra en caja (servicios + venta de productos), informativo.
  const grossIncome = computed(() => serviceRevenue.value + productRevenue.value)

  return {
    serviceRevenue,
    barberCommissions,
    productRevenue,
    productCost,
    productMargin,
    productUnits,
    expensesTotal,
    expensesByCategory,
    expensesInRange,
    netProfit,
    grossIncome,
    salesInRange,
  }
}
