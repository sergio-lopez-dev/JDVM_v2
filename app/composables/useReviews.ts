import { addDoc, collection, deleteDoc, doc, serverTimestamp } from 'firebase/firestore'
import type { Review, ReviewInput } from '~~/schemas'

export function useReviews() {
  const db = useFirestore()
  const col = collection(db, 'reviews')
  const reviews = useCollection<Review>(col)

  const byBarber = (barberId: string) =>
    computed(() => reviews.value.filter((r) => r.barberId === barberId))

  const averageFor = (barberId: string) =>
    computed(() => {
      const list = reviews.value.filter((r) => r.barberId === barberId)
      if (!list.length) return 0
      return list.reduce((sum, r) => sum + r.score, 0) / list.length
    })

  const create = (input: ReviewInput) => addDoc(col, { ...input, createdAt: serverTimestamp() })
  const remove = (id: string) => deleteDoc(doc(db, 'reviews', id))

  return { reviews, byBarber, averageFor, create, remove }
}
