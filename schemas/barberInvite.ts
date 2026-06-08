import { z } from 'zod'
import { barberInputSchema } from './barber'

// Invitación de barbero. El admin la crea (sin cuenta de Auth todavía); el barbero
// se "reclama" en su primer acceso (con Google o contraseña usando ESTE email) y
// entonces se le crea barbers/{uid} + users/{uid}.role='barber'. El id del doc es el
// email normalizado (lowercase) → búsqueda directa por email al loguearse.
export const barberInviteSchema = z.object({
  id: z.string(),
  email: z.string(),
  // Datos del barbero a materializar al aceptar (mismo shape que BarberInput).
  barber: barberInputSchema,
  status: z.enum(['pending', 'accepted']).default('pending'),
  createdAt: z.date().optional(),
  acceptedAt: z.date().optional(),
  acceptedUid: z.string().optional(),
})
export type BarberInvite = z.infer<typeof barberInviteSchema>

// Normaliza un email para usarlo como id de doc y para comparar.
export const normalizeEmail = (email: string) => email.trim().toLowerCase()
