import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import type { Alert, AlertInput } from '~~/schemas'

// Avisos / banners del estudio (colección `alerts`).
export function useAlerts() {
  const db = useFirestore()
  const col = collection(db, 'alerts')

  const alerts = useCollection<Alert>(query(col, orderBy('createdAt', 'desc')))
  const active = computed(() => alerts.value.filter((a) => a.active))

  const create = (input: AlertInput) =>
    addDoc(col, { ...input, createdAt: serverTimestamp() })
  const update = (id: string, patch: Partial<AlertInput>) =>
    updateDoc(doc(db, 'alerts', id), patch)
  const remove = (id: string) => deleteDoc(doc(db, 'alerts', id))

  return { alerts, active, create, update, remove }
}
