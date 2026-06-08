import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  increment,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import type { PaymentMethod, Product, ProductSale } from '~~/schemas'

// Ventas de producto. Cada venta guarda snapshot de coste/precio (para que el
// histórico no cambie al reprecificar) y descuenta stock del producto.
export function useProductSales() {
  const db = useFirestore()
  const col = collection(db, COL.productSales)
  const sales = useCollection<ProductSale>(query(col, orderBy('soldAt', 'desc')))

  // Registrar venta: crea el doc + descuenta stock. `barberId` = quién la registró.
  async function sell(
    product: Product,
    opts: { qty?: number; barberId: string; paymentMethod?: PaymentMethod },
  ) {
    const qty = Math.max(1, Math.round(opts.qty ?? 1))
    await addDoc(col, {
      productId: product.id,
      productName: product.name,
      qty,
      unitCost: product.costPrice,
      unitPrice: product.salePrice,
      barberId: opts.barberId,
      ...(opts.paymentMethod ? { paymentMethod: opts.paymentMethod } : {}),
      soldAt: serverTimestamp(),
      createdAt: serverTimestamp(),
    })
    await updateDoc(doc(db, COL.products, product.id), { stock: increment(-qty) })
  }

  // Anular una venta (devuelve el stock).
  async function remove(sale: ProductSale) {
    await deleteDoc(doc(db, COL.productSales, sale.id))
    await updateDoc(doc(db, COL.products, sale.productId), {
      stock: increment(sale.qty),
    }).catch(() => {
      /* el producto pudo borrarse; ignoramos el reajuste de stock */
    })
  }

  return { sales, sell, remove }
}
