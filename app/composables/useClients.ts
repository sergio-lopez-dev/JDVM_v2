import { collection, deleteDoc, doc, setDoc } from 'firebase/firestore'
import type { Client, ProfileInput } from '~~/schemas'

export function useClients() {
  const db = useFirestore()

  // Listado completo (solo admin lo podrá leer según firestore.rules).
  const clients = useCollection<Client>(collection(db, COL.users))

  // Doc de un cliente concreto (para staff: leer estado de veto de su cliente sin
  // cargar toda la colección).
  const clientById = (uid: Ref<string | null>) =>
    useDocument<Client>(computed(() => (uid.value ? doc(db, COL.users, uid.value) : null)))

  // Actualizar el perfil propio (o de cualquiera si admin).
  const updateProfile = (uid: string, patch: Partial<ProfileInput>) =>
    setDoc(doc(db, COL.users, uid), patch, { merge: true })

  // Vetar / readmitir cliente (solo staff). Bloquea coger nuevas citas.
  const setBanned = (uid: string, banned: boolean) =>
    setDoc(doc(db, COL.users, uid), { banned }, { merge: true })

  // Eliminar la ficha del cliente (doc users/{uid}). La cuenta de Auth NO se puede
  // borrar desde el cliente (requiere Admin SDK); si vuelve a entrar, se recrea la
  // ficha como cliente nuevo (sin veto) → para impedir el acceso, usar el veto.
  const removeClient = (uid: string) => deleteDoc(doc(db, COL.users, uid))

  return { clients, clientById, updateProfile, setBanned, removeClient }
}
