import { z } from 'zod'
import { timeRangeSchema, dateRangeSchema } from './common'

export const waitlistEntrySchema = z.object({
  id: z.string(),
  clientId: z.string(),
  serviceId: z.string(),
  // null = cualquier barbero disponible.
  preferredBarberId: z.string().nullable().default(null),
  timeRange: timeRangeSchema,
  preferredDates: dateRangeSchema,
  notified: z.boolean().default(false),
  createdAt: z.date().optional(),
})
export type WaitlistEntry = z.infer<typeof waitlistEntrySchema>

export const waitlistEntryInputSchema = waitlistEntrySchema.omit({ id: true })
export type WaitlistEntryInput = z.infer<typeof waitlistEntryInputSchema>
