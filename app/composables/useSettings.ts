import { doc, setDoc } from 'firebase/firestore'
import type { Settings } from '~~/schemas'

// Documento único de configuración del local: settings/main.
export function useSettings() {
  const db = useFirestore()
  const ref = doc(db, 'settings', 'main')
  const settings = useDocument<Settings>(ref)

  const save = (patch: Partial<Settings>) => setDoc(ref, patch, { merge: true })

  return { settings, save }
}
