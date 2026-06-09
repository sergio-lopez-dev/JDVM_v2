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

/** "10:00 – 14:00 · 17:00 – 20:30" o "Cerrado" para mostrar el horario de un día. */
export function formatDayHours(dt?: DayTimetable): string {
  if (!dt || (!dt.morning && !dt.afternoon)) return 'Cerrado'
  const parts: string[] = []
  if (dt.morning) parts.push(`${dt.morning.start} – ${dt.morning.end}`)
  if (dt.afternoon) parts.push(`${dt.afternoon.start} – ${dt.afternoon.end}`)
  return parts.join(' · ')
}

/** ¿Está abierto el local en `now`? Devuelve si está abierto y a qué hora cierra. */
export function openStatus(
  dt: DayTimetable | undefined,
  now: Date,
): { open: boolean; closesAt?: string } {
  const wins = dayWindows(now, dt)
  for (const w of wins) {
    if (now >= w.start && now < w.end) {
      return { open: true, closesAt: `${String(w.end.getHours()).padStart(2, '0')}:${String(w.end.getMinutes()).padStart(2, '0')}` }
    }
  }
  return { open: false }
}

/** ¿El barbero está de vacaciones ese día? */
export function isOnVacation(date: Date, vacations: DateRange[]): boolean {
  return vacations.some((r) => isWithinRange(date, r))
}

/**
 * Intervalos LIBRES de un día: (horario local ∩ horario barbero) − ocupados.
 * Para mostrar los huecos disponibles en las agendas (barbero/admin). Descarta
 * huecos menores que `minMinutes` y, si se pasa `now` y es el mismo día, recorta
 * el tiempo ya pasado.
 */
export function freeWindows(opts: {
  day: Date
  localTimetable?: DayTimetable
  barberTimetable?: DayTimetable
  busy?: Interval[]
  now?: Date
  minMinutes?: number
}): Interval[] {
  const local = dayWindows(opts.day, opts.localTimetable)
  const barber = dayWindows(opts.day, opts.barberTimetable)
  const windows =
    local.length && barber.length ? intersectWindows(local, barber) : local.length ? local : barber
  const busy = (opts.busy ?? []).slice().sort((a, b) => a.start.getTime() - b.start.getTime())
  const minMs = (opts.minMinutes ?? 1) * MS_MIN
  const isToday = opts.now ? sameDay(opts.day, opts.now) : false
  const floor = isToday ? opts.now!.getTime() : -Infinity

  const out: Interval[] = []
  for (const w of windows) {
    let cursor = Math.max(w.start.getTime(), floor)
    const winEnd = w.end.getTime()
    for (const b of busy) {
      const bs = Math.max(b.start.getTime(), w.start.getTime())
      const be = Math.min(b.end.getTime(), winEnd)
      if (be <= cursor || bs >= winEnd) continue
      if (bs > cursor && bs - cursor >= minMs) out.push({ start: new Date(cursor), end: new Date(bs) })
      if (be > cursor) cursor = be
    }
    if (winEnd - cursor >= minMs) out.push({ start: new Date(cursor), end: new Date(winEnd) })
  }
  return out
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
