import { z } from 'zod'

// Notificaciones in-app (como el legacy: colección `notifications`).
// Sin FCM por ahora; la PWA instalada da el acceso directo. Cloud Functions
// podrá enviar push en Fase 5 leyendo esta misma colección.
export const NOTIFICATION_TYPES = [
  'cita_cancelada',
  'cita_nueva',
  'recordatorio',
  'campania',
  'aviso',
] as const
export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES)
export type NotificationType = z.infer<typeof notificationTypeSchema>

// A quién va dirigida: a un usuario concreto (targetUid) o a un rol.
export const NOTIFICATION_AUDIENCES = ['admin', 'barber', 'client', 'user'] as const
export const notificationAudienceSchema = z.enum(NOTIFICATION_AUDIENCES)
export type NotificationAudience = z.infer<typeof notificationAudienceSchema>

export const notificationSchema = z.object({
  id: z.string(),
  type: notificationTypeSchema,
  title: z.string().min(1),
  body: z.string().default(''),
  audience: notificationAudienceSchema.default('admin'),
  // Si va a una persona concreta (cliente de una campaña, barbero afectado…).
  targetUid: z.string().optional(),
  appointmentId: z.string().optional(),
  read: z.boolean().default(false),
  createdAt: z.date().optional(),
})
export type Notification = z.infer<typeof notificationSchema>

export const notificationInputSchema = notificationSchema.omit({ id: true })
export type NotificationInput = z.infer<typeof notificationInputSchema>
