import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import type { Barber, BarberInput } from '~~/schemas'

export function useBarbers() {
  const db = useFirestore()
  const col = collection(db, 'barbers')
  const barbers = useCollection<Barber>(col)

  const active = computed(() => barbers.value.filter((b) => b.active))
  const bySlug = (slug: string) =>
    computed(() => barbers.value.find((b) => b.slug === slug) ?? null)

  const create = (input: BarberInput) => addDoc(col, input)
  const update = (id: string, patch: Partial<BarberInput>) =>
    updateDoc(doc(db, 'barbers', id), patch)
  const remove = (id: string) => deleteDoc(doc(db, 'barbers', id))

  return { barbers, active, bySlug, create, update, remove }
}
