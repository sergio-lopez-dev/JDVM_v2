import { z } from 'zod'
import { appointmentStatusSchema, paymentMethodSchema } from './common'

export const appointmentSchema = z.object({
  id: z.string(),
  clientId: z.string(),
  barberId: z.string(), // NUEVO en v2: obligatorio (multi-barbero)
  serviceId: z.string(),
  startsAt: z.date(),
  endsAt: z.date(),
  status: appointmentStatusSchema.default('booked'),
  // Se congela al pasar a 'completed'.
  priceSnapshot: z.number().nonnegative().optional(),
  tip: z.number().nonnegative().optional(),
  paymentMethod: paymentMethodSchema.optional(),
  isRecurring: z.boolean().default(false),
  createdAt: z.date().optional(),
})
export type Appointment = z.infer<typeof appointmentSchema>

export const appointmentInputSchema = appointmentSchema.omit({ id: true })
export type AppointmentInput = z.infer<typeof appointmentInputSchema>
