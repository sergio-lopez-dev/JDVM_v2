import { z } from 'zod'

// Primitivas y enums compartidos por todas las entidades.
// Zod 3 (vee-validate aún no soporta Zod 4). Tipos vía z.infer.

export const ROLES = ['client', 'barber', 'admin'] as const
export const roleSchema = z.enum(ROLES)
export type Role = z.infer<typeof roleSchema>

export const WEEKDAYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const
export const weekdaySchema = z.enum(WEEKDAYS)
export type Weekday = z.infer<typeof weekdaySchema>

export const APPOINTMENT_STATUSES = ['booked', 'completed', 'cancelled', 'no_show'] as const
export const appointmentStatusSchema = z.enum(APPOINTMENT_STATUSES)
export type AppointmentStatus = z.infer<typeof appointmentStatusSchema>

// Pagos: SIN pasarela online (decisión C). Cobro en el local: efectivo o tarjeta
// (datáfono), o QR a Revolut. Para la facturación lo que importa es efectivo vs
// el resto (tarjeta/Revolut = no-efectivo).
export const PAYMENT_METHODS = ['cash', 'card', 'revolut'] as const
export const paymentMethodSchema = z.enum(PAYMENT_METHODS)
export type PaymentMethod = z.infer<typeof paymentMethodSchema>

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  revolut: 'Revolut',
}
// Cubo de facturación: efectivo vs no-efectivo (tarjeta/Revolut). undefined = efectivo
// (es el método por defecto al cobrar una cita).
export const isCashPayment = (m?: PaymentMethod | null) => m == null || m === 'cash'

// Teléfono España: exactamente 9 dígitos numéricos.
export const phoneEsSchema = z.string().regex(/^\d{9}$/, 'El teléfono debe tener 9 dígitos')

// Hora del día como "HH:mm".
export const timeStringSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Hora inválida (formato HH:mm)')

export const timeRangeSchema = z.object({ start: timeStringSchema, end: timeStringSchema })
export type TimeRange = z.infer<typeof timeRangeSchema>

export const dateRangeSchema = z.object({ start: z.date(), end: z.date() })
export type DateRange = z.infer<typeof dateRangeSchema>

export const hexColorSchema = z
  .string()
  .regex(/^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/, 'Color hex inválido')
