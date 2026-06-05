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
