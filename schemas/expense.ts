import { z } from 'zod'

// Categorías de gasto del negocio. Lista fija (suficiente para una barbería);
// "other" como cajón de sastre. El label se muestra en la UI.
export const EXPENSE_CATEGORIES = [
  { id: 'rent', name: 'Alquiler', icon: 'i-lucide-building-2' },
  { id: 'utilities', name: 'Suministros', icon: 'i-lucide-zap' }, // luz, agua, gas, internet
  { id: 'tax', name: 'Autónomo / impuestos', icon: 'i-lucide-landmark' },
  { id: 'supplies', name: 'Material', icon: 'i-lucide-package' },
  { id: 'salary', name: 'Nóminas', icon: 'i-lucide-users' },
  { id: 'other', name: 'Otros', icon: 'i-lucide-receipt' },
] as const

export const expenseCategorySchema = z.enum([
  'rent',
  'utilities',
  'tax',
  'supplies',
  'salary',
  'other',
])
export type ExpenseCategory = z.infer<typeof expenseCategorySchema>

export const expenseCategoryLabel = (id: string) =>
  EXPENSE_CATEGORIES.find((c) => c.id === id)?.name ?? 'Otros'

export const expenseSchema = z.object({
  id: z.string(),
  concept: z.string().min(1),
  category: expenseCategorySchema.default('other'),
  amount: z.number().nonnegative(),
  // 'once' = gasto puntual con fecha; 'monthly' = se repite cada mes desde `date`.
  recurrence: z.enum(['once', 'monthly']).default('once'),
  // 'once': fecha del gasto. 'monthly': desde cuándo aplica.
  date: z.date(),
  // Solo 'monthly': hasta cuándo aplica (ausente = indefinido).
  endDate: z.date().optional(),
  note: z.string().default(''),
  createdAt: z.date().optional(),
})
export type Expense = z.infer<typeof expenseSchema>

export const expenseInputSchema = expenseSchema.omit({ id: true })
export type ExpenseInput = z.infer<typeof expenseInputSchema>
