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
  // Orden en que aparece el barbero en el selector de reserva del cliente (asc).
  // Lo fija el admin en Equipo; a igualdad de valor se desempata por nombre.
  sortOrder: z.number().int().default(0),
  // Barbero TEMPORAL: su acceso a la app caduca fuera del rango [validFrom, validUntil].
  // Fuera de ese rango no aparece en reserva ni puede entrar en /staff (lo bloquea el
  // middleware). validFrom opcional (def. = desde ya); validUntil = último día válido.
  temporary: z.boolean().default(false),
  validFrom: z.date().optional(),
  validUntil: z.date().optional(),
})
export type Barber = z.infer<typeof barberSchema>

export const barberInputSchema = barberSchema.omit({ id: true })
export type BarberInput = z.infer<typeof barberInputSchema>
