import { toDate } from './datetime'
import type { Expense, ProductSale } from '~~/schemas'

// Importe de un gasto que cae dentro de [start, end).
// - 'once': su importe si la fecha está en el rango.
// - 'monthly': el importe por cada MES NATURAL del rango en el que esté activo
//   (desde el mes de su fecha de inicio; hasta endDate si existe).
// El cálculo es exacto cuando el rango está alineado a meses (la vista usa meses).
export function expenseAmountInRange(e: Expense, start: Date, end: Date): number {
  if (e.recurrence === 'once') {
    const t = toDate(e.date).getTime()
    return t >= start.getTime() && t < end.getTime() ? e.amount : 0
  }
  const from = toDate(e.date)
  const fromMonth = new Date(from.getFullYear(), from.getMonth(), 1)
  const until = e.endDate ? toDate(e.endDate) : null
  let total = 0
  const cur = new Date(start.getFullYear(), start.getMonth(), 1)
  while (cur < end) {
    const monthStart = new Date(cur.getFullYear(), cur.getMonth(), 1)
    const monthEnd = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    const overlapsRange = monthEnd > start && monthStart < end
    const hasStarted = monthStart >= fromMonth
    const notEnded = !until || monthStart <= until
    if (overlapsRange && hasStarted && notEnded) total += e.amount
    cur.setMonth(cur.getMonth() + 1)
  }
  return total
}

export const saleRevenue = (s: ProductSale) => s.unitPrice * s.qty
export const saleCost = (s: ProductSale) => s.unitCost * s.qty
export const saleMargin = (s: ProductSale) => (s.unitPrice - s.unitCost) * s.qty
