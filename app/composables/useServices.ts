import { addDoc, collection, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import type { Service, ServiceInput } from '~~/schemas'

export function useServices() {
  const db = useFirestore()
  const col = collection(db, COL.services)
  const services = useCollection<Service>(col)

  // Los privados no salen en lista pública ni en reserva.
  const publicServices = computed(() => services.value.filter((s) => !s.isPrivate))

  const create = (input: ServiceInput) => addDoc(col, input)
  const update = (id: string, patch: Partial<ServiceInput>) =>
    updateDoc(doc(db, COL.services, id), patch)
  const remove = (id: string) => deleteDoc(doc(db, COL.services, id))

  return { services, publicServices, create, update, remove }
}
