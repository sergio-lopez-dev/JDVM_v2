import type { Weekday } from '../schemas/common'

// Firestore Timestamp -> Date sin importar firebase/firestore (duck typing).
export function toDate(value: unknown): Date {
  if (value instanceof Date) return value
  if (value && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate()
  }
  return new Date(value as string | number)
}

const JS_DAY_TO_WEEKDAY: Record<number, Weekday> = {
  0: 'sun',
  1: 'mon',
  2: 'tue',
  3: 'wed',
  4: 'thu',
  5: 'fri',
  6: 'sat',
}

export function weekdayOf(date: Date): Weekday {
  return JS_DAY_TO_WEEKDAY[date.getDay()]!
}

export function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

/** ¿`date` cae dentro del rango [start, end] (inclusive por día)? */
export function isWithinRange(date: Date, range: { start: Date; end: Date }): boolean {
  return date.getTime() >= range.start.getTime() && date.getTime() <= range.end.getTime()
}

/**
 * ¿`day` es una ocurrencia de una cita fija periódica? La serie arranca en su `anchor`
 * (primera ocurrencia / fecha de inicio): los días ANTERIORES no tocan. Para
 * `intervalWeeks > 1` solo tocan las semanas alineadas con el ancla. Sin ancla (series
 * antiguas) → siempre toca (comportamiento semanal de siempre). Asume que `day` ya cae
 * en el weekday correcto de la serie (se comprueba aparte).
 */
export function fixedOccursOn(day: Date, anchor?: Date | null, intervalWeeks?: number | null): boolean {
  const interval = Math.max(1, intervalWeeks ?? 1)
  if (!anchor) return true
  const a = new Date(anchor)
  a.setHours(0, 0, 0, 0)
  const d = new Date(day)
  d.setHours(0, 0, 0, 0)
  const weeks = Math.round((d.getTime() - a.getTime()) / (7 * 86_400_000))
  return weeks >= 0 && weeks % interval === 0
}
