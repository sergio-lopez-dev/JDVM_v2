import { toDate, weekdayOf } from '~~/lib/datetime'
import { fmtDate } from '~~/lib/format'
import { effectivePrice } from '~~/schemas'
import type { Appointment } from '~~/schemas'

export interface DayCount {
  date: Date
  label: string
  count: number
  revenue: number
}
export interface RankRow {
  id: string
  name: string
  count: number
  revenue: number
}

// Las citas que cuentan como "realizadas" para ingresos.
const DONE = new Set(['booked', 'completed'])

// Agregados para la pantalla Reports sobre un rango [start, end).
export function useAdminStats(start: Ref<Date>, end: Ref<Date>) {
  const { inRange } = useAppointments()
  const { services } = useServices()
  const { barbers } = useBarbers()

  const appts = inRange(start, end)

  function priceOf(a: Appointment): number {
    if (a.priceSnapshot != null) return a.priceSnapshot
    const svc = services.value.find((s) => s.id === a.serviceId)
    return svc ? effectivePrice(svc, a.barberId) : 0
  }

  const valid = computed(() => appts.value.filter((a) => DONE.has(a.status)))

  const totals = computed(() => ({
    appointments: valid.value.length,
    revenue: valid.value.reduce((sum, a) => sum + priceOf(a), 0),
    cancelled: appts.value.filter((a) => a.status === 'cancelled').length,
    noShow: appts.value.filter((a) => a.status === 'no_show').length,
  }))

  // Serie por día dentro del rango (para el gráfico de líneas/barras).
  const perDay = computed<DayCount[]>(() => {
    const days: DayCount[] = []
    const cur = new Date(start.value)
    cur.setHours(0, 0, 0, 0)
    while (cur < end.value) {
      const next = new Date(cur)
      next.setDate(next.getDate() + 1)
      const inDay = valid.value.filter((a) => {
        const t = toDate(a.startsAt).getTime()
        return t >= cur.getTime() && t < next.getTime()
      })
      days.push({
        date: new Date(cur),
        label: fmtDate(cur, 'EEE d'),
        count: inDay.length,
        revenue: inDay.reduce((s, a) => s + priceOf(a), 0),
      })
      cur.setDate(cur.getDate() + 1)
    }
    return days
  })

  // Ranking de servicios por nº de citas.
  const topServices = computed<RankRow[]>(() => {
    const map = new Map<string, RankRow>()
    for (const a of valid.value) {
      const svc = services.value.find((s) => s.id === a.serviceId)
      const row = map.get(a.serviceId) ?? {
        id: a.serviceId,
        name: svc?.name ?? 'Servicio',
        count: 0,
        revenue: 0,
      }
      row.count += 1
      row.revenue += priceOf(a)
      map.set(a.serviceId, row)
    }
    return [...map.values()].sort((a, b) => b.count - a.count)
  })

  // Ocupación / facturación por barbero.
  const perBarber = computed<RankRow[]>(() =>
    barbers.value
      .map((b) => {
        const list = valid.value.filter((a) => a.barberId === b.id)
        return {
          id: b.id,
          name: b.name,
          count: list.length,
          revenue: list.reduce((s, a) => s + priceOf(a), 0),
        }
      })
      .sort((a, b) => b.count - a.count),
  )

  // Distribución por día de la semana (ocupación típica).
  const perWeekday = computed(() => {
    const counts: Record<string, number> = {}
    for (const a of valid.value) {
      const wd = weekdayOf(toDate(a.startsAt))
      counts[wd] = (counts[wd] ?? 0) + 1
    }
    return counts
  })

  return { appts, valid, totals, perDay, topServices, perBarber, perWeekday }
}
