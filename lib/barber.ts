import { toDate } from './datetime'
import type { Barber } from '../schemas/barber'

// Campos de vigencia de un barbero temporal (validFrom/validUntil llegan como Date o
// como Timestamp de Firestore; `toDate` normaliza ambos).
type TemporalBarber = Pick<Barber, 'temporary' | 'validFrom' | 'validUntil'>

/**
 * ¿El acceso del barbero está CADUCADO (o aún no ha empezado)? Solo aplica a barberos
 * temporales: fuera del rango [validFrom, validUntil] (inclusive por día) no tienen
 * acceso. Un barbero no temporal nunca caduca.
 */
export function barberAccessExpired(b: TemporalBarber, now: Date = new Date()): boolean {
  if (!b.temporary) return false
  const t = now.getTime()
  if (b.validFrom) {
    const start = toDate(b.validFrom)
    start.setHours(0, 0, 0, 0)
    if (t < start.getTime()) return true // aún no ha empezado
  }
  if (b.validUntil) {
    const end = toDate(b.validUntil)
    end.setHours(23, 59, 59, 999)
    if (t > end.getTime()) return true // ya caducó
  }
  return false
}
