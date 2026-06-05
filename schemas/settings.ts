import { z } from 'zod'
import { weekdaySchema, dateRangeSchema } from './common'
import { weekTimetableSchema } from './barber'

// Regla de horario especial para un rango de fechas (festivos, horarios reducidos…).
export const specialTimetableRuleSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  range: dateRangeSchema,
  timetable: weekTimetableSchema,
})
export type SpecialTimetableRule = z.infer<typeof specialTimetableRuleSchema>

// Documento único de configuración del local (settings/main).
export const settingsSchema = z.object({
  // Horario de apertura general del local por día de semana.
  timetable: weekTimetableSchema.default({}),
  daysClosed: z.array(weekdaySchema).default([]),
  // Paso de la rejilla de huecos en minutos (los slots se alinean a este paso).
  slotStepMinutes: z.number().int().positive().default(15),
  acceptingAppointments: z.boolean().default(true),
  acceptingCancellations: z.boolean().default(true),
  special: z.array(specialTimetableRuleSchema).default([]),
})
export type Settings = z.infer<typeof settingsSchema>
