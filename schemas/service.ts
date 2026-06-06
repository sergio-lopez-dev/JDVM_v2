import { z } from 'zod'
import { hexColorSchema } from './common'

// Categorías de la carta: AHORA son configurables por el admin (no un enum fijo).
// Se guardan en settings.serviceCategories; cada servicio referencia una por `id`.
export const serviceCategoryDefSchema = z.object({ id: z.string(), name: z.string().min(1) })
export type ServiceCategoryDef = z.infer<typeof serviceCategoryDefSchema>

export const DEFAULT_SERVICE_CATEGORIES: ServiceCategoryDef[] = [
  { id: 'cortes', name: 'Cortes' },
  { id: 'barba', name: 'Barba' },
  { id: 'color', name: 'Color' },
  { id: 'premium', name: 'Premium' },
  { id: 'extras', name: 'Extras' },
]

export const serviceSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  description: z.string().default(''),
  // Duración configurable por el admin (decisión E). El generador de slots la respeta.
  durationMinutes: z.number().int().positive(),
  basePrice: z.number().nonnegative(),
  // Override de precio por barbero (barberId -> precio).
  priceOverrides: z.record(z.string(), z.number().nonnegative()).optional(),
  // Override de duración por barbero (barberId -> minutos). Mismo patrón que el precio.
  durationOverrides: z.record(z.string(), z.number().int().positive()).optional(),
  color: hexColorSchema.optional(),
  // id de una categoría configurable (settings.serviceCategories). Texto libre.
  category: z.string().optional(),
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

/** Duración efectiva (min) de un servicio para un barbero (override o base). */
export function effectiveDuration(service: Service, barberId?: string): number {
  if (barberId && service.durationOverrides?.[barberId] != null) {
    return service.durationOverrides[barberId]
  }
  return service.durationMinutes
}
