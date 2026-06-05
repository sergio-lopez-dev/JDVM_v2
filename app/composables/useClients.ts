import { collection, doc, setDoc } from 'firebase/firestore'
import type { Client, ProfileInput } from '~~/schemas'

export function useClients() {
  const db = useFirestore()

  // Listado completo (solo admin lo podrá leer según firestore.rules).
  const clients = useCollection<Client>(collection(db, 'users'))

  // Actualizar el perfil propio (o de cualquiera si admin).
  const updateProfile = (uid: string, patch: Partial<ProfileInput>) =>
    setDoc(doc(db, 'users', uid), patch, { merge: true })

  return { clients, updateProfile }
}
