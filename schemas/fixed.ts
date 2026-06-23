import { z } from 'zod'
import { weekdaySchema, timeStringSchema } from './common'

// Plantilla de cita fija (semanal). El admin la crea; se materializan citas
// concretas (appointments con isRecurring + fixedId) para las próximas semanas.
export const fixedAppointmentSchema = z.object({
  id: z.string(),
  // Vacío ('') si es un cliente NO registrado (nombre/teléfono a mano).
  clientId: z.string(),
  clientName: z.string().optional(),
  clientPhone: z.string().optional(),
  barberId: z.string(),
  serviceId: z.string(),
  weekday: weekdaySchema,
  time: timeStringSchema, // "HH:mm"
  // Periodicidad en semanas: 1 = cada semana, 2 = cada dos semanas, 3, 4…
  // Ausente (undefined) = 1 (compatibilidad con series ya creadas).
  intervalWeeks: z.number().int().min(1).max(4).optional(),
  // Fecha (medianoche local) de la PRIMERA ocurrencia de la serie. Ancla el cálculo
  // de qué semanas "tocan" cuando intervalWeeks > 1 (para bloquear la reserva más allá
  // de las 12 semanas materializadas). Se fija al crear la serie.
  anchorDate: z.date().optional(),
  active: z.boolean().default(true),
  // Fechas (yyyy-MM-dd) en las que la serie NO aplica: el admin "liberó" ese día
  // concreto (p. ej. el cliente avisó que falla). El hueco queda libre para reservas
  // sin borrar el resto de la serie.
  exceptions: z.array(z.string()).optional(),
  createdAt: z.date().optional(),
})
export type FixedAppointment = z.infer<typeof fixedAppointmentSchema>

export const fixedAppointmentInputSchema = fixedAppointmentSchema.omit({ id: true })
export type FixedAppointmentInput = z.infer<typeof fixedAppointmentInputSchema>
