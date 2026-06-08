import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from 'firebase/firestore'
import type { Product, ProductInput } from '~~/schemas'

// Catálogo de productos de venta (coste/unidad + precio de venta + stock).
export function useProducts() {
  const db = useFirestore()
  const col = collection(db, COL.products)
  const products = useCollection<Product>(col)

  const active = computed(() => products.value.filter((p) => p.active))
  const lowStock = computed(() => active.value.filter((p) => p.stock <= p.lowStock))

  const create = (input: ProductInput) => addDoc(col, { ...input, createdAt: serverTimestamp() })
  const update = (id: string, patch: Partial<ProductInput>) =>
    updateDoc(doc(db, COL.products, id), patch)
  const remove = (id: string) => deleteDoc(doc(db, COL.products, id))

  return { products, active, lowStock, create, update, remove }
}
