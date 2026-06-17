import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import type { Service, ServiceInput } from '~~/schemas'

export function useServices() {
  const db = useFirestore()
  const col = collection(db, COL.services)
  const raw = useCollection<Service>(col)

  // Orden de la carta configurable por el admin (sortOrder asc, desempate por nombre).
  // Al ordenar aquí, TODA la app (carta, reserva, catálogo) hereda el mismo orden.
  const byOrder = (a: Service, b: Service) =>
    (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, 'es')
  const services = computed(() => [...raw.value].sort(byOrder))

  // Los privados no salen en lista pública ni en reserva.
  const publicServices = computed(() => services.value.filter((s) => !s.isPrivate))

  const create = (input: ServiceInput) => addDoc(col, input)
  const update = (id: string, patch: Partial<ServiceInput>) =>
    updateDoc(doc(db, COL.services, id), patch)
  const remove = (id: string) => deleteDoc(doc(db, COL.services, id))

  return { services, publicServices, create, update, remove }
}
