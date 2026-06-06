import { z } from 'zod'
import { weekdaySchema, timeRangeSchema, dateRangeSchema, hexColorSchema } from './common'

// Horario de un día: mañana y/o tarde (cualquiera puede faltar = cerrado).
export const dayTimetableSchema = z.object({
  morning: timeRangeSchema.optional(),
  afternoon: timeRangeSchema.optional(),
})
export type DayTimetable = z.infer<typeof dayTimetableSchema>

// Horario semanal: día de semana -> horario (parcial; días ausentes = cerrado).
export const weekTimetableSchema = z.record(weekdaySchema, dayTimetableSchema)
export type WeekTimetable = z.infer<typeof weekTimetableSchema>

export const barberSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  slug: z.string().min(1),
  photoUrl: z.string().url().or(z.literal('')).default(''),
  bio: z.string().default(''),
  instagram: z.string().optional(),
  color: hexColorSchema,
  active: z.boolean().default(true),
  servicesOffered: z.array(z.string()).default([]),
  timetable: weekTimetableSchema.default({}),
  vacations: z.array(dateRangeSchema).default([]),
  // % de los servicios que se lleva el barbero (lo fija el admin). El resto es
  // del local. Solo lo ve el propio barbero y el admin, no la caja total.
  commissionPercent: z.number().int().min(0).max(100).default(50),
})
export type Barber = z.infer<typeof barberSchema>

export const barberInputSchema = barberSchema.omit({ id: true })
export type BarberInput = z.infer<typeof barberInputSchema>
