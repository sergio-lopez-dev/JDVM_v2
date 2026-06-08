import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import type { Expense, ExpenseInput } from '~~/schemas'

// Gastos del negocio (alquiler, suministros, autónomo…). Puntuales o mensuales.
export function useExpenses() {
  const db = useFirestore()
  const col = collection(db, COL.expenses)
  const expenses = useCollection<Expense>(col)

  const create = (input: ExpenseInput) => addDoc(col, { ...input, createdAt: serverTimestamp() })
  const update = (id: string, patch: Partial<ExpenseInput>) =>
    updateDoc(doc(db, COL.expenses, id), patch)
  const remove = (id: string) => deleteDoc(doc(db, COL.expenses, id))

  return { expenses, create, update, remove }
}
