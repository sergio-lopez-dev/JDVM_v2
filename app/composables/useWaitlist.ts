import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  query,
  serverTimestamp,
  where,
} from 'firebase/firestore'
import type { WaitlistEntry, WaitlistEntryInput } from '~~/schemas'

export function useWaitlist() {
  const db = useFirestore()
  const user = useCurrentUser()
  const col = collection(db, 'waitlist')

  const mine = useCollection<WaitlistEntry>(
    computed(() => (user.value ? query(col, where('clientId', '==', user.value.uid)) : null)),
  )

  const alreadyOnList = computed(() => mine.value.length > 0)

  const join = (input: WaitlistEntryInput) =>
    addDoc(col, { ...input, createdAt: serverTimestamp() })
  const leave = (id: string) => deleteDoc(doc(db, 'waitlist', id))

  return { mine, alreadyOnList, join, leave }
}
