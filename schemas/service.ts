import { z } from 'zod'
import { hexColorSchema } from './common'

export const SERVICE_CATEGORIES = ['cortes', 'barba', 'color', 'premium', 'extras'] as const
export const serviceCategorySchema = z.enum(SERVICE_CATEGORIES)
export type ServiceCategory = z.infer<typeof serviceCategorySchema>

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  // Duración configurable por el admin (decisión E). El generador de slots la respeta.
  durationMinutes: z.number().int().positive(),
  basePrice: z.number().nonnegative(),
  // Override de precio por barbero (barberId -> precio).
  priceOverrides: z.record(z.string(), z.number().nonnegative()).optional(),
  color: hexColorSchema.optional(),
  category: serviceCategorySchema.optional(),
  isPrivate: z.boolean().default(false),
})
export type Service = z.infer<typeof serviceSchema>

export const serviceInputSchema = serviceSchema.omit({ id: true })
export type ServiceInput = z.infer<typeof serviceInputSchema>

/** Precio efectivo de un servicio para un barbero (override o base). */
export function effectivePrice(service: Service, barberId?: string): number {
  if (barberId && service.priceOverrides?.[barberId] != null) {
    return service.priceOverrides[barberId]
  }
  return service.basePrice
}
