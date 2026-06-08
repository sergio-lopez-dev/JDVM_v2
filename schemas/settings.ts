import { z } from 'zod'
import { weekdaySchema, dateRangeSchema } from './common'
import { weekTimetableSchema } from './barber'
import { loyaltyConfigSchema } from './loyalty'
import { serviceCategoryDefSchema, DEFAULT_SERVICE_CATEGORIES } from './service'

// Regla de horario especial para un rango de fechas (festivos, horarios reducidos…).
export const specialTimetableRuleSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  range: dateRangeSchema,
  timetable: weekTimetableSchema,
})
export type SpecialTimetableRule = z.infer<typeof specialTimetableRuleSchema>

// Paleta de marca aplicada a TODA la app (las direcciones de diseño).
// Mantener en sync con lib/themes.ts (BRAND_THEMES).
export const themeKeySchema = z.enum(['forest', 'brass', 'copper', 'burgundy', 'steel', 'bone', 'midnight', 'ember', 'plum', 'emerald', 'noir'])
export type ThemeKey = z.infer<typeof themeKeySchema>

// Datos de marca/contacto del estudio (white-label). Lo muestra toda la app y se
// edita en /admin/ajustes. Antes estaban hardcodeados ("JDVM", "Maracena"…).
export const studioInfoSchema = z.object({
  name: z.string().default('JDVM Hair Studio'),
  // Ciudad/zona para textos (p. ej. "Maracena, Granada").
  city: z.string().default(''),
  phone: z.string().default(''),
  email: z.string().default(''),
  whatsapp: z.string().default(''),
  address: z.string().default(''),
  instagram: z.string().default(''),
  facebook: z.string().default(''),
  tiktok: z.string().default(''),
  mapsUrl: z.string().default(''),
  foundedYear: z.number().int().default(2018),
  // Logos subidos por el admin (Storage). Vacío = se usa el logo por defecto.
  logoUrl: z.string().default(''),
  logoPath: z.string().default(''),
  logoMarkUrl: z.string().default(''),
  logoMarkPath: z.string().default(''),
  // Vídeo del hero (landing y home de la app). Vacío = se usa /video/hero.mp4.
  heroVideoUrl: z.string().default(''),
  heroVideoPath: z.string().default(''),
})
export type StudioInfo = z.infer<typeof studioInfoSchema>

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
  // Paleta de marca de toda la app (la elige el admin en /admin/ajustes).
  theme: themeKeySchema.default('forest'),
  // Datos de contacto/marca del estudio (web pública).
  studio: studioInfoSchema.default({}),
  // Programa de fidelización "Socio" (puntos/niveles/recompensas).
  loyalty: loyaltyConfigSchema.default({}),
  // Categorías de la carta, gestionables por el admin.
  serviceCategories: z.array(serviceCategoryDefSchema).default(DEFAULT_SERVICE_CATEGORIES),
})
export type Settings = z.infer<typeof settingsSchema>
