import { z } from 'zod'
import { weekdaySchema, timeStringSchema } from './common'

// Plantilla de cita fija (semanal). El admin la crea; se materializan citas
// concretas (appointments con isRecurring + fixedId) para las próximas semanas.
export const fixedAppointmentSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  barberId: z.string(),
  serviceId: z.string(),
  weekday: weekdaySchema,
  time: timeStringSchema, // "HH:mm"
  active: z.boolean().default(true),
  createdAt: z.date().optional(),
})
export type FixedAppointment = z.infer<typeof fixedAppointmentSchema>

export const fixedAppointmentInputSchema = fixedAppointmentSchema.omit({ id: true })
export type FixedAppointmentInput = z.infer<typeof fixedAppointmentInputSchema>
