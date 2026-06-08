import { z } from 'zod'
import { paymentMethodSchema } from './common'

// Producto de venta en el local (cera, champú, etc.). El admin fija coste y
// precio de venta; se lleva control de stock (unidades). El margen es del local.
export const productSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  // Coste por unidad (lo que le cuesta al local).
  costPrice: z.number().nonnegative(),
  // Precio de venta al cliente.
  salePrice: z.number().nonnegative(),
  // Unidades disponibles (baja con cada venta).
  stock: z.number().int().default(0),
  // Umbral para avisar de "stock bajo".
  lowStock: z.number().int().nonnegative().default(3),
  active: z.boolean().default(true),
  createdAt: z.date().optional(),
})
export type Product = z.infer<typeof productSchema>

export const productInputSchema = productSchema.omit({ id: true })
export type ProductInput = z.infer<typeof productInputSchema>

// Venta de un producto. Guarda snapshot de coste/precio para que el histórico no
// cambie si luego se reprecian. `barberId` = quién registró la venta (admin o barbero).
export const productSaleSchema = z.object({
  id: z.string(),
  productId: z.string(),
  productName: z.string(), // snapshot del nombre
  qty: z.number().int().positive().default(1),
  unitCost: z.number().nonnegative(), // snapshot
  unitPrice: z.number().nonnegative(), // snapshot
  barberId: z.string(),
  paymentMethod: paymentMethodSchema.optional(),
  soldAt: z.date(),
  createdAt: z.date().optional(),
})
export type ProductSale = z.infer<typeof productSaleSchema>
