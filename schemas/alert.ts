import { z } from 'zod'

// Noticias destacadas / banners del estudio (colección `alerts`). El admin las crea
// desde el panel; con `push: true` se hace además difusión push a todos los clientes
// (Cloud Function onAlertCreated).
export const ALERT_LEVELS = ['info', 'success', 'warning'] as const
export const alertLevelSchema = z.enum(ALERT_LEVELS)
export type AlertLevel = z.infer<typeof alertLevelSchema>

export const alertSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  body: z.string().default(''),
  level: alertLevelSchema.default('info'),
  // Si está activo, se muestra como banner en la app del cliente.
  active: z.boolean().default(true),
  // Si true, al publicarla se hace difusión push a todos los clientes (no solo banner).
  push: z.boolean().default(false),
  createdAt: z.date().optional(),
})
export type Alert = z.infer<typeof alertSchema>

export const alertInputSchema = alertSchema.omit({ id: true })
export type AlertInput = z.infer<typeof alertInputSchema>
