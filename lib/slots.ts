import type { DayTimetable, WeekTimetable } from '../schemas/barber'
import type { DateRange } from '../schemas/common'
import { sameDay, weekdayOf, isWithinRange } from './datetime'

export interface Interval {
  start: Date
  end: Date
}

const MS_MIN = 60_000

function atTime(day: Date, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(day)
  d.setHours(h ?? 0, m ?? 0, 0, 0)
  return d
}

/** Ventanas (mañana/tarde) de un día concreto a partir de su horario. */
function dayWindows(day: Date, dt?: DayTimetable): Interval[] {
  if (!dt) return []
  const out: Interval[] = []
  if (dt.morning) out.push({ start: atTime(day, dt.morning.start), end: atTime(day, dt.morning.end) })
  if (dt.afternoon)
    out.push({ start: atTime(day, dt.afternoon.start), end: atTime(day, dt.afternoon.end) })
  return out
}

function intersectWindows(a: Interval[], b: Interval[]): Interval[] {
  const out: Interval[] = []
  for (const x of a) {
    for (const y of b) {
      const start = new Date(Math.max(x.start.getTime(), y.start.getTime()))
      const end = new Date(Math.min(x.end.getTime(), y.end.getTime()))
      if (start < end) out.push({ start, end })
    }
  }
  return out
}

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end
}

/** Horario efectivo de un día (de un horario semanal). */
export function resolveDayTimetable(week: WeekTimetable, date: Date): DayTimetable | undefined {
  return week[weekdayOf(date)]
}

/** ¿El barbero está de vacaciones ese día? */
export function isOnVacation(date: Date, vacations: DateRange[]): boolean {
  return vacations.some((r) => isWithinRange(date, r))
}

export interface GenerateSlotsOptions {
  /** Día objetivo (se usa su fecha; la hora se ignora salvo `now`). */
  day: Date
  /** Duración del servicio en minutos (decisión E). */
  durationMinutes: number
  /** Horario del local ya resuelto para ese día. */
  localTimetable?: DayTimetable
  /** Horario del barbero ya resuelto para ese día (omitir si vacaciones/cerrado). */
  barberTimetable?: DayTimetable
  /** Intervalos ocupados ese día (citas existentes del barbero). */
  busy?: Interval[]
  /** Paso de la rejilla en minutos (def. 15). */
  stepMinutes?: number
  /** Ahora (para descartar huecos pasados si el día es hoy). */
  now?: Date
}

/**
 * Genera los inicios de hueco disponibles:
 * (horario local ∩ horario barbero) − ocupados, respetando la duración del
 * servicio (no se solapa) y descartando pasados si el día es hoy.
 */
export function generateSlots(opts: GenerateSlotsOptions): Date[] {
  const step = opts.stepMinutes ?? 15
  const now = opts.now ?? new Date()
  const dur = opts.durationMinutes
  const busy = opts.busy ?? []
  const isToday = sameDay(opts.day, now)

  const local = dayWindows(opts.day, opts.localTimetable)
  const barber = dayWindows(opts.day, opts.barberTimetable)
  // Intersección local ∩ barbero. Si falta uno de los dos, se usa el otro.
  const windows = local.length && barber.length ? intersectWindows(local, barber) : local.length ? local : barber

  const slots: Date[] = []
  for (const w of windows) {
    let t = new Date(w.start)
    while (t.getTime() + dur * MS_MIN <= w.end.getTime()) {
      const slot: Interval = { start: new Date(t), end: new Date(t.getTime() + dur * MS_MIN) }
      const past = isToday && slot.start.getTime() <= now.getTime()
      const clash = busy.some((b) => overlaps(slot, b))
      if (!past && !clash) slots.push(slot.start)
      t = new Date(t.getTime() + step * MS_MIN)
    }
  }
  return slots
}
